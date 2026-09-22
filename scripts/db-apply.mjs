// Applies supabase/migrations/*.sql through the Management API.
//
// `supabase db push` needs the database password; this needs only the personal
// access token, which is the one credential available on a machine without
// Docker. Statements are sent per file, so each file is one transaction.
//
//   node scripts/db-apply.mjs <project-ref>

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const ref = process.argv[2] ?? projectRefFromEnv()
if (!ref) {
  console.error('usage: node scripts/db-apply.mjs [project-ref]')
  process.exit(1)
}

function projectRefFromEnv() {
  try {
    const env = readFileSync(join(root, '.env.local'), 'utf8')
    return env.match(/VITE_SUPABASE_URL=https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  } catch {
    return undefined
  }
}

const token =
  process.env.SUPABASE_ACCESS_TOKEN ??
  readFileSync(join(root, '.supabase-token'), 'utf8').trim()

async function run(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  const body = await response.text()
  if (!response.ok) throw new Error(`${response.status} ${body}`)
  return body
}

const dir = join(root, 'supabase', 'migrations')
const files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()

for (const file of files) {
  process.stdout.write(`applying ${file} … `)
  try {
    await run(readFileSync(join(dir, file), 'utf8'))
    console.log('ok')
  } catch (error) {
    console.log('FAILED')
    console.error(String(error.message).slice(0, 2000))
    process.exit(1)
  }
}

console.log(`\n${files.length} migration(s) applied to ${ref}.`)
