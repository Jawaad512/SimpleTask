// Acceptance checks for the phases in the build prompt that have a server-side
// criterion.
//
// ===========================================================================
//  THIS SCRIPT PERMANENTLY DELETES EVERY ROW THE OWNER ACCOUNT HAS.
//
//  Not a dry run, not a sandbox, not a transaction that rolls back. It empties
//  tasks, habits, tags, deadlines, categories and user_settings against the
//  LIVE project, at the start of the run and again at the end, because the
//  assertions below need an account with known contents.
//
//  On 2026-09-28 this destroyed a real board. The reader had seen the name
//  "test" and assumed it was safe. See docs/incidents/ for the write-up. The
//  refusal below is the fix: the script now counts the owner's rows first and
//  will not run if it finds any.
//
//    npm run test:acceptance                 checks, refuses if data exists
//    npm run test:acceptance -- --force      deletes it anyway
//
//  `npm test` does NOT run this. It runs typecheck and lint, which touch
//  nothing. That is deliberate — see the incident write-up.
// ===========================================================================

import { createInterface } from 'node:readline/promises'

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Windows PowerShell writes a BOM; strip it before parsing.
const read = (name) => readFileSync(join(root, name), 'utf8').replace(/^\uFEFF/, '')

const env = Object.fromEntries(
  read('.env.local')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf('=')
      return [line.slice(0, at), line.slice(at + 1)]
    }),
)

const creds = Object.fromEntries(
  read('.credentials.local')
    .split(/\r?\n/)
    .filter((line) => line.includes(':'))
    .map((line) => {
      const at = line.indexOf(':')
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
    }),
)

const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY
const service = JSON.parse(read('.apikeys.json')).find((k) => k.id === 'service_role').api_key

let passed = 0
let failed = 0

function check(label, condition, detail) {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

function phase(name) {
  console.log(`\n${name}`)
}

const localDate = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// supabase-js constructs a realtime client eagerly and Node 20 has no native
// WebSocket. Nothing here subscribes, so a stub is enough.
if (!globalThis.WebSocket) globalThis.WebSocket = class {}

const owner = createClient(url, anon, { auth: { persistSession: false } })
const admin = createClient(url, service, { auth: { persistSession: false } })

// ---------------------------------------------------------------------------

phase('Phase 1 — auth and row level security')

const signIn = await owner.auth.signInWithPassword({
  email: creds.email,
  password: creds.password,
})
check('owner signs in with email and password', !signIn.error, signIn.error?.message)
const ownerId = signIn.data.user?.id

// ---------------------------------------------------------------------------
// The refusal. Everything below this point destroys data, so nothing below it
// runs until we have looked at what is about to be destroyed and said so out
// loud. Counting first is the whole point: a script that silently empties an
// account it was pointed at by mistake is indistinguishable from a bug.
// ---------------------------------------------------------------------------

const DESTROYS = ['tasks', 'habits', 'tags', 'deadlines', 'categories', 'user_settings']

const force = process.argv.includes('--force') || process.env.ACCEPTANCE_FORCE === '1'

const counts = {}
for (const table of DESTROYS) {
  const column = table === 'user_settings' ? 'user_id' : 'id'
  const { count } = await owner
    .from(table)
    .select(column, { count: 'exact', head: true })
    .eq('user_id', ownerId)
  counts[table] = count ?? 0
}

const occupied = Object.entries(counts).filter(([, n]) => n > 0)

if (occupied.length > 0 && !force) {
  console.log(`
  STOP — this account is not empty.
`)
  for (const [table, n] of occupied) console.log(`        ${String(n).padStart(5)}  ${table}`)
  console.log(`
  This script deletes all of the above, permanently, and there is no undo.
  It is meant for a throwaway account, not one holding real tasks.

  If this is your real board: do not run this. Back it up first.
  If you are certain you want it gone: npm run test:acceptance -- --force
`)
  process.exit(1)
}

if (force && occupied.length > 0) {
  const total = occupied.reduce((sum, [, n]) => sum + n, 0)
  console.log(`
  --force given. About to permanently delete ${total} row(s).
`)
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question('  Type DELETE to continue: ')
    rl.close()
    if (answer.trim() !== 'DELETE') {
      console.log('  Aborted. Nothing was deleted.')
      process.exit(1)
    }
  }
}

// Start from a clean slate for repeat runs.
for (const table of ['task_tags', 'tasks', 'habits', 'tags', 'deadlines', 'categories']) {
  if (table === 'task_tags') continue
  await owner.from(table).delete().eq('user_id', ownerId)
}
await owner.from('user_settings').delete().eq('user_id', ownerId)

const anonClient = createClient(url, anon, { auth: { persistSession: false } })
const intruderEmail = `rls-probe-${Date.now()}@example.com`
const intruderPassword = 'Probe-Password-9271'
const { data: intruder } = await admin.auth.admin.createUser({
  email: intruderEmail,
  password: intruderPassword,
  email_confirm: true,
})
const other = createClient(url, anon, { auth: { persistSession: false } })
await other.auth.signInWithPassword({ email: intruderEmail, password: intruderPassword })

// ---------------------------------------------------------------------------

phase('Phase 2 — categories')

const made = []
for (const [index, [name, slot]] of [['Study', 1], ['Admin', 10], ['Fitness', 5]].entries()) {
  const { data, error } = await owner
    .from('categories')
    .insert({ user_id: ownerId, name, color_slot: slot, position: index })
    .select()
    .single()
  if (error) console.log(`        insert ${name}: ${error.message}`)
  made.push(data)
}
check('three categories created', made.every(Boolean))

const dupe = await owner
  .from('categories')
  .insert({ user_id: ownerId, name: 'Clash', color_slot: 1, position: 9 })
check('a second category cannot take an occupied colour slot', Boolean(dupe.error))

const swap = await owner.rpc('set_category_slot', { p_category: made[0].id, p_slot: 10 })
const afterSwap = await owner.from('categories').select('id, color_slot').in('id', [made[0].id, made[1].id])
const slotOf = (id) => afterSwap.data?.find((row) => row.id === id)?.color_slot
check(
  'recolouring into a taken slot swaps the two categories',
  !swap.error && slotOf(made[0].id) === 10 && slotOf(made[1].id) === 1,
  swap.error?.message ?? JSON.stringify(afterSwap.data),
)

// ---------------------------------------------------------------------------

phase('Phase 3 — quick-add lands in today + quick')

const taskInsert = await owner
  .from('tasks')
  .insert({
    user_id: ownerId,
    title: 'Read the chapter',
    category_id: made[0].id,
    is_today: true,
    is_quick: true,
    is_instant: true,
    position: 1024,
  })
  .select()
  .single()

const task = taskInsert.data
check(
  'new task is today + quick with the flag set',
  task?.is_today === true && task?.is_quick === true && task?.is_instant === true,
  taskInsert.error?.message,
)
check('carry_over_count starts at zero', task?.carry_over_count === 0)

const restrict = await owner.rpc('delete_category', { p_category: made[0].id, p_move_to: null })
check('a category with tasks cannot be deleted outright', Boolean(restrict.error))

// ---------------------------------------------------------------------------

phase('Phase 1 — isolation (checked now that a row exists)')

const anonRead = await anonClient.from('categories').select('id')
check('a signed-out client reads no categories', (anonRead.data?.length ?? 0) === 0)

const otherRead = await other.from('categories').select('id')
check('another signed-in user reads no categories', (otherRead.data?.length ?? 0) === 0)

const otherTaskRead = await other.from('tasks').select('id')
check('another signed-in user reads no tasks', (otherTaskRead.data?.length ?? 0) === 0)

const ownerTag = await owner
  .from('tags')
  .insert({ user_id: ownerId, name: 'exam' })
  .select()
  .single()

const crossLink = await other.from('task_tags').insert({ task_id: task.id, tag_id: ownerTag.data.id })
check('the join table is policed through its parent task', Boolean(crossLink.error))

const ownLink = await owner.from('task_tags').insert({ task_id: task.id, tag_id: ownerTag.data.id })
check('the owner can tag their own task', !ownLink.error, ownLink.error?.message)

const dupeTag = await owner.rpc('upsert_tag', { p_name: 'EXAM' })
const tagCount = await owner.from('tags').select('id')
check(
  'upsert_tag matches case-insensitively instead of creating a duplicate',
  !dupeTag.error && tagCount.data?.length === 1,
  dupeTag.error?.message,
)

// ---------------------------------------------------------------------------

phase('Phase 4 / 6 — triage and the under-5-minute flag')

const moved = await owner
  .from('tasks')
  .update({ is_today: false, is_quick: true, position: 512 })
  .eq('id', task.id)
  .select()
  .single()
check(
  'a move writes both axes and the fractional position',
  moved.data?.is_today === false && moved.data?.is_quick === true && moved.data?.position === 512,
  moved.error?.message,
)
check('the flag survives a move that keeps the task quick', moved.data?.is_instant === true)

const toLong = await owner
  .from('tasks')
  .update({ is_quick: false })
  .eq('id', task.id)
  .select()
  .single()
check(
  'moving into the 20-min-plus column clears the flag',
  toLong.data?.is_quick === false && toLong.data?.is_instant === false,
  toLong.error?.message,
)

const forceQuick = await owner
  .from('tasks')
  .update({ is_instant: true })
  .eq('id', task.id)
  .select()
  .single()
check(
  'setting the flag forces the task quick',
  forceQuick.data?.is_instant === true && forceQuick.data?.is_quick === true,
  forceQuick.error?.message,
)

// An insert asking for the flag on a long task is not a contradiction to
// reject — §8 says setting the flag forces the task quick.
await owner.from('tasks').insert({
  user_id: ownerId,
  title: 'Contradictory',
  category_id: made[0].id,
  is_quick: false,
  is_today: true,
  is_instant: true,
})
const normalised = await owner
  .from('tasks')
  .select('is_instant, is_quick')
  .eq('title', 'Contradictory')
  .maybeSingle()
check(
  'an insert can never store is_instant on a non-quick task',
  normalised.data !== null && !(normalised.data.is_instant && !normalised.data.is_quick),
  JSON.stringify(normalised.data),
)
await owner.from('tasks').delete().eq('title', 'Contradictory')

// ---------------------------------------------------------------------------

phase('Phase 5 — completion returns to the exact quadrant and position')

await owner.from('tasks').update({ is_today: true, is_quick: true, position: 777.5 }).eq('id', task.id)
const before = (await owner.from('tasks').select('*').eq('id', task.id).single()).data

await owner.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', task.id)
const done = (await owner.from('tasks').select('*').eq('id', task.id).single()).data
check('completing stamps completed_at', done.status === 'done' && done.completed_at !== null)
check(
  'completing does not touch the axes',
  done.is_today === before.is_today && done.is_quick === before.is_quick,
)

await owner.from('tasks').update({ status: 'active', completed_at: null }).eq('id', task.id)
const restored = (await owner.from('tasks').select('*').eq('id', task.id).single()).data
check(
  'restoring returns the task to its original quadrant and position',
  restored.status === 'active' &&
    restored.completed_at === null &&
    restored.is_today === before.is_today &&
    restored.is_quick === before.is_quick &&
    restored.position === before.position,
  JSON.stringify({ restored: restored.position, before: before.position }),
)

// ---------------------------------------------------------------------------

phase('Phase 8 — rollover is idempotent')

const habit = (
  await owner
    .from('habits')
    .insert({ user_id: ownerId, title: 'Morning pages', category_id: made[0].id, is_quick: true, position: 0 })
    .select()
    .single()
).data

await owner.from('tasks').insert({
  user_id: ownerId,
  title: 'Morning pages',
  category_id: made[0].id,
  is_today: true,
  is_quick: true,
  habit_id: habit.id,
  is_ephemeral: true,
  position: 2048,
})

await owner.from('tasks').insert({
  user_id: ownerId,
  title: 'Stale completion',
  category_id: made[0].id,
  is_today: true,
  is_quick: true,
  status: 'done',
  completed_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
  position: 3072,
})

await owner.from('user_settings').upsert({ user_id: ownerId, last_rollover_on: localDate(-1) })

const first = await owner.rpc('run_daily_rollover', { p_local_date: localDate() })
const firstResult = Array.isArray(first.data) ? first.data[0] : first.data
check('the rollover runs once for a new local day', firstResult?.did_run === true, first.error?.message)
check('a task left in the top row gains a carry-over', firstResult?.carried_over === 1, JSON.stringify(firstResult))
check('the habit instance is deleted, not carried', firstResult?.habits_cleared === 1)
check('completions older than 24 hours are hard-deleted', firstResult?.completed_purged === 1)

const carried = (await owner.from('tasks').select('carry_over_count').eq('id', task.id).single()).data
check('carry_over_count incremented exactly once', carried.carry_over_count === 1)

const second = await owner.rpc('run_daily_rollover', { p_local_date: localDate() })
const secondResult = Array.isArray(second.data) ? second.data[0] : second.data
check('running again the same day changes nothing', secondResult?.did_run === false)

const carriedAgain = (await owner.from('tasks').select('carry_over_count').eq('id', task.id).single()).data
check('a second run does not double-count', carriedAgain.carry_over_count === 1)

const surviving = await owner.from('tasks').select('id, is_today').eq('status', 'active')
check(
  'the top row is never auto-emptied',
  surviving.data?.every((row) => row.is_today === true),
  JSON.stringify(surviving.data),
)

// ---------------------------------------------------------------------------

phase('Future notes — the pad is on the row, not in the browser')

const padRead = await owner.from('user_settings').select('future_notes').maybeSingle()
check(
  'future_notes exists and defaults to an empty pad',
  !padRead.error && (padRead.data?.future_notes ?? '') === '',
  padRead.error?.message ?? JSON.stringify(padRead.data),
)

// Upsert rather than update: this is the call the client makes, and on a fresh
// account there may be no settings row for it to update.
const padWrite = await owner
  .from('user_settings')
  .upsert({ user_id: ownerId, future_notes: 'Renew passport' }, { onConflict: 'user_id' })
check('the owner can write the pad', !padWrite.error, padWrite.error?.message)

const padBack = await owner.from('user_settings').select('*').maybeSingle()
check(
  'the pad reads back as written',
  padBack.data?.future_notes === 'Renew passport',
  padBack.error?.message,
)
check(
  'writing the pad leaves last_rollover_on alone',
  padBack.data?.last_rollover_on === localDate(),
  String(padBack.data?.last_rollover_on),
)

const padIntruder = await other.from('user_settings').select('future_notes')
check('another signed-in user reads no pad', (padIntruder.data?.length ?? 0) === 0)

const padTooLong = await owner
  .from('user_settings')
  .upsert({ user_id: ownerId, future_notes: 'x'.repeat(20_001) }, { onConflict: 'user_id' })
check('a pad over the cap is rejected', Boolean(padTooLong.error))

// ---------------------------------------------------------------------------

phase('Cleanup')

for (const table of ['tasks', 'habits', 'tags', 'deadlines', 'categories']) {
  await owner.from(table).delete().eq('user_id', ownerId)
}
await owner.from('user_settings').delete().eq('user_id', ownerId)
if (intruder?.user?.id) await admin.auth.admin.deleteUser(intruder.user.id)
const leftovers = await owner.from('categories').select('id')
check('the owner account is back to empty', (leftovers.data?.length ?? 0) === 0)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
