// Verifies the guest_leads policies: anyone may write, only the owner may read.
//
//   node scripts/check-leads.mjs
//
// Safe to delete. It writes two rows and removes them again at the end.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => readFileSync(join(root, name), 'utf8').replace(/^\uFEFF/, '')

const env = Object.fromEntries(
  read('.env.local')
    .split(/\r?\n/)
    .filter((line) => line.includes('='))
    .map((line) => {
      const at = line.indexOf('=')
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
    }),
)

const credentials = Object.fromEntries(
  read('.credentials.local')
    .split(/\r?\n/)
    .filter((line) => /^(email|password):/.test(line))
    .map((line) => {
      const at = line.indexOf(':')
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
    }),
)

const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

// supabase-js constructs a realtime client eagerly and Node 20 has no native
// WebSocket. Nothing here subscribes, so a stub is enough.
if (!globalThis.WebSocket) globalThis.WebSocket = class {}

const guest = createClient(url, anonKey, { auth: { persistSession: false } })
const owner = createClient(url, anonKey, { auth: { persistSession: false } })

let failures = 0
function check(label, passed, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
}

const stamp = Date.now()
const email = `check-${stamp}@example.com`

// --- signed-out guest -------------------------------------------------------

const insertInterest = await guest.from('guest_interest').insert({ email })
check('guest can leave an email', !insertInterest.error, insertInterest.error?.message)

const duplicate = await guest.from('guest_interest').insert({ email })
check('the same email cannot be counted twice', duplicate.error?.code === '23505', duplicate.error?.code)

const badEmail = await guest.from('guest_interest').insert({ email: 'not-an-email' })
check('a malformed email is rejected', Boolean(badEmail.error), badEmail.error?.code)

const insertFeedback = await guest
  .from('guest_feedback')
  .insert({ message: `policy check ${stamp}`, email: null })
check('guest can leave feedback without an email', !insertFeedback.error, insertFeedback.error?.message)

const guestReadInterest = await guest.from('guest_interest').select('id')
check('guest reads no emails', (guestReadInterest.data?.length ?? 0) === 0)

const guestReadFeedback = await guest.from('guest_feedback').select('id')
check('guest reads no feedback', (guestReadFeedback.data?.length ?? 0) === 0)

const guestCount = await guest.from('guest_interest').select('*', { count: 'exact', head: true })
check('guest cannot count the emails', (guestCount.count ?? 0) === 0)

// --- signed-in owner --------------------------------------------------------

const signIn = await owner.auth.signInWithPassword({
  email: credentials.email,
  password: credentials.password,
})
check('owner signs in', !signIn.error, signIn.error?.message)

const ownerInterest = await owner.from('guest_interest').select('*')
check('owner reads the emails', (ownerInterest.data?.length ?? 0) >= 1, ownerInterest.error?.message)
check(
  'the email just left is there',
  Boolean(ownerInterest.data?.some((row) => row.email === email)),
)

const ownerFeedback = await owner.from('guest_feedback').select('*')
check('owner reads the feedback', (ownerFeedback.data?.length ?? 0) >= 1, ownerFeedback.error?.message)

const ownerCount = await owner.from('guest_interest').select('*', { count: 'exact', head: true })
check('owner counts the emails', typeof ownerCount.count === 'number', String(ownerCount.count))

// --- clean up ---------------------------------------------------------------

await owner.from('guest_interest').delete().eq('email', email)
await owner.from('guest_feedback').delete().eq('message', `policy check ${stamp}`)

const leftover = await owner.from('guest_interest').select('id').eq('email', email)
check('the check leaves nothing behind', (leftover.data?.length ?? 0) === 0)

await owner.auth.signOut()

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
