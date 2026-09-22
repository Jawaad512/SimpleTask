// Ad-hoc SQL against the linked project, for verification.
//
//   node scripts/db-query.mjs <project-ref> "select 1"
//   node scripts/db-query.mjs <project-ref> --file path/to.sql

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const [ref, ...rest] = process.argv.slice(2)
if (!ref || rest.length === 0) {
  console.error('usage: node scripts/db-query.mjs <project-ref> "<sql>" | --file <path>')
  process.exit(1)
}

const sql = rest[0] === '--file' ? readFileSync(rest[1], 'utf8') : rest.join(' ')

const token =
  process.env.SUPABASE_ACCESS_TOKEN ??
  readFileSync(join(root, '.supabase-token'), 'utf8').trim()

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})

const body = await response.text()
if (!response.ok) {
  console.error(`${response.status} ${body}`)
  process.exit(1)
}

try {
  console.log(JSON.stringify(JSON.parse(body), null, 2))
} catch {
  console.log(body)
}
