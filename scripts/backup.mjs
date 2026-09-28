// Exports everything the owner account holds to a timestamped JSON file.
//
//   npm run backup
//   npm run backup -- --out somewhere/else
//
// Reads only. It signs in as the owner and selects; it never writes to the
// database, so it is safe to run at any time and safe to run often.
//
// The in-database archive (deleted_rows) covers an accidental delete. This
// covers the case the archive cannot: losing the project itself. Keep the
// output somewhere that is not Supabase.

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Windows PowerShell writes a BOM; strip it before parsing.
const read = (name) => readFileSync(join(root, name), 'utf8').replace(/^﻿/, '')

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

// supabase-js constructs a realtime client eagerly and Node 20 has no native
// WebSocket. Nothing here subscribes, so a stub is enough.
if (!globalThis.WebSocket) globalThis.WebSocket = class {}

const owner = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const signIn = await owner.auth.signInWithPassword({
  email: creds.email,
  password: creds.password,
})

if (signIn.error) {
  console.error(`sign-in failed: ${signIn.error.message}`)
  process.exit(1)
}

// Foreign-key order. restore.mjs walks this same list forwards, so the parents
// are always in place before the rows that reference them.
const TABLES = ['categories', 'tags', 'habits', 'tasks', 'task_tags', 'deadlines', 'user_settings']

const tables = {}
let total = 0

for (const table of TABLES) {
  const { data, error } = await owner.from(table).select('*')
  if (error) {
    console.error(`  ${table}: ${error.message}`)
    process.exit(1)
  }
  tables[table] = data ?? []
  total += tables[table].length
  console.log(`  ${String(tables[table].length).padStart(5)}  ${table}`)
}

if (total === 0) {
  console.log('\nThe account is empty. Writing the file anyway — an empty backup')
  console.log('is still a fact about what was there, and refusing to write one')
  console.log('would hide it.')
}

const outFlag = process.argv.indexOf('--out')
const dir = outFlag === -1 ? join(root, 'backups') : resolve(process.argv[outFlag + 1])
mkdirSync(dir, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const file = join(dir, `simpletask-${stamp}.json`)

writeFileSync(
  file,
  JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      userId: signIn.data.user?.id ?? null,
      project: env.VITE_SUPABASE_URL,
      tables,
    },
    null,
    2,
  ),
  'utf8',
)

console.log(`\n${total} row(s) → ${file}`)
