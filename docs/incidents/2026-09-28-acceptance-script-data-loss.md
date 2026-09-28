# 2026-09-28 — `npm test` destroyed the production board

**Severity:** total, unrecoverable loss of the owner account's task data.
**Cause:** a destructive script named `test`, run without reading it first.

## What happened

While adding the Timer feature and the Future-pad sync, an assistant ran:

```
npm test
```

as a routine "did I break anything" check, in the same spirit as `npm run
typecheck` or `npm run lint`.

At the time, `npm test` was wired to `node scripts/acceptance.mjs`. That script
signs in as the owner and, before asserting anything, deletes every row the
owner account has:

```js
for (const table of ['tasks', 'habits', 'tags', 'deadlines', 'categories']) {
  await owner.from(table).delete().eq('user_id', ownerId)
}
await owner.from('user_settings').delete().eq('user_id', ownerId)
```

It does this twice — once to get a known-empty starting state, once as cleanup.
It ran against the live Supabase project, which is the only project there is.
The board was emptied. Postgres deletes are not soft; there is no undo, and the
project had no restorable backup.

The run reported `30 passed, 0 failed`. From the output alone, nothing looked
wrong. That is the worst part of this failure mode: it succeeds loudly while
destroying the thing it was pointed at.

## Why it wasn't caught

Four things lined up, and every one of them is fixable:

1. **The name lied.** `npm test` means "safe to run, tells me if I broke
   something" in every JavaScript project. Here it meant "delete the database".
   Naming is the control that fires before anyone reads anything.
2. **The warning was far from the trigger.** The README did say *"it empties the
   owner account at both ends — so do not run it against an account holding real
   tasks."* But that sentence was in a section two hundred lines below the
   `npm run test` table row, and nothing at the point of use repeated it.
3. **The script did not look before it leapt.** It deleted unconditionally. It
   never counted what was there, never printed it, never asked. A script that
   cannot tell a throwaway account from a real one will eventually be pointed at
   the real one.
4. **One account for everything.** Development, acceptance and real use shared a
   single Supabase project and a single login, so "the test account" and "my
   data" were the same rows.

The assistant's own error sits on top of these: it treated a command as safe
because of its name, and read the README warning only afterwards. Running an
unfamiliar script against a live system is a decision, not a formality, and it
should have read `scripts/acceptance.mjs` first — it is 250 lines, and the
deletes are in the first 90.

## What changed

**`npm test` is now safe.** It runs `typecheck && lint` and touches nothing:

```json
"test": "npm run typecheck && npm run lint",
"test:acceptance": "node scripts/acceptance.mjs",
```

The destructive suite has to be asked for by its full name. Muscle memory can no
longer reach it.

**The script refuses to run against an account with data in it.** Before the
first delete it counts the owner's rows, and if it finds any it prints them and
exits non-zero:

```
  STOP — this account is not empty.

        14  tasks
         3  habits
         2  deadlines
         5  categories

  This script deletes all of the above, permanently, and there is no undo.
```

Getting past that needs `--force`, and in a terminal `--force` still requires
typing `DELETE` at a prompt. An accidental run is now impossible; only a
deliberate one gets through.

**The warning moved to the top of the file it describes.** `scripts/acceptance.mjs`
opens with a banner saying what it destroys, and `AGENTS.md` states the rule for
anyone — human or agent — working in this repo.

## What would have prevented it outright

The guards above stop a repeat, but they are a second line of defence. The first
line is not sharing one database between "real" and "disposable":

- **A second Supabase project for acceptance runs.** The suite points at it by
  env var and cannot reach production, whatever anyone types. This is the real
  fix and it is not yet done.
- **Backups.** Supabase restorable backups are a paid-plan feature. On the free
  plan there is nothing to restore from, so a bad delete is final. Either move to
  a plan with backups, or run a periodic export.

## Rules going forward

1. Never run an unfamiliar script against a live system without reading it.
   A script's name is not evidence of what it does.
2. Anything that deletes must count first, show what it found, and require an
   explicit confirmation. Silence plus a zero exit code is not proof of safety.
3. A destructive operation does not belong behind a conventional, harmless-
   sounding command name.
4. Warnings live at the point of use, not in a document someone might read later.
