// Puts a backup file back into the owner account.
//
//   npm run restore -- backups/simpletask-2026-09-28T14-30-00.json
//   npm run restore -- <file> --force
//
// Upserts rather than inserts, so running it twice is the same as running it
// once, and so a partial restore can be finished by running it again.
//
// It refuses to run against an account that already has rows in it, because
// merging a backup into a live board silently resurrects things you deleted on
// purpose. --force says you meant it.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => readFileSync(join(root, name), 'utf8').replace(/^﻿/, '')

const args = process.argv.slice(2)
const force = args.includes('--force')
const path = args.find((arg) => !arg.startsWith('--'))

if (!path) {
  console.error('usage: npm run restore -- <backup.json> [--force]')
  process.exit(1)
}

const backup = JSON.parse(readFileSync(resolve(path), 'utf8').replace(/^﻿/, ''))
if (backup.version !== 1) {
  console.error(`unknown backup version: ${backup.version}`)
  process.exit(1)
}

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

const ownerId = signIn.data.user?.id

if (backup.userId && backup.userId !== ownerId) {
  console.error(`\nThis backup belongs to a different account.`)
  console.error(`  backup: ${backup.userId}`)
  console.error(`  signed in as: ${ownerId}`)
  process.exit(1)
}

// Parents before children. Same order backup.mjs wrote them in.
const TABLES = ['categories', 'tags', 'habits', 'tasks', 'task_tags', 'deadlines', 'user_settings']

const existing = {}
for (const table of TABLES) {
  const column = table === 'user_settings' ? 'user_id' : 'id'
  const { count } = await owner
    .from(table)
    .select(column, { count: 'exact', head: true })
    .eq('user_id', ownerId)
  existing[table] = count ?? 0
}

const occupied = Object.entries(existing).filter(([, n]) => n > 0)

if (occupied.length > 0 && !force) {
  console.log('\n  This account already has rows in it:\n')
  for (const [table, n] of occupied) console.log(`        ${String(n).padStart(5)}  ${table}`)
  console.log(`
  Restoring on top of a live board brings back anything you deleted on
  purpose since the backup was taken, and there is no way to tell the two
  apart afterwards.

  Take a backup of the current state first:   npm run backup
  Then, if you still want this:               npm run restore -- ${path} --force
`)
  process.exit(1)
}

// task_tags has a composite key; everything else is keyed on id.
const CONFLICT = { task_tags: 'task_id,tag_id', user_settings: 'user_id' }

let total = 0

for (const table of TABLES) {
  const rows = backup.tables?.[table] ?? []
  if (rows.length === 0) {
    console.log(`  ${'—'.padStart(5)}  ${table}`)
    continue
  }

  const { error } = await owner
    .from(table)
    .upsert(rows, { onConflict: CONFLICT[table] ?? 'id' })

  if (error) {
    console.error(`  ${table}: ${error.message}`)
    console.error('\nStopped. Tables before this one were restored; run again to continue.')
    process.exit(1)
  }

  total += rows.length
  console.log(`  ${String(rows.length).padStart(5)}  ${table}`)
}

console.log(`\n${total} row(s) restored from ${path}`)
