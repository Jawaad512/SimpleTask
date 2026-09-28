# Working in this repo

SimpleTask is a single-user personal task app. There is **one** Supabase project
and **one** account, and it holds real data that is used daily. There is no
staging environment. Treat every command that talks to the database as talking
to production, because it is.

## Never run these without being asked

```
npm run test:acceptance      deletes every row the owner account has
```

This is not a sandbox and not a dry run. It empties `tasks`, `habits`, `tags`,
`deadlines`, `categories` and `user_settings` against the live project, at the
start of the run and again at the end, and reports `30 passed` while doing it.

It now refuses to run if the account has any rows in it, so an accident is no
longer possible — but do not reach for it, and do not pass `--force`, unless the
user has asked for it in those words.

**On 2026-09-28 this destroyed the user's entire board.** An assistant ran
`npm test` — which at the time pointed here — as a routine check. Nothing was
recoverable. See `docs/incidents/2026-09-28-acceptance-script-data-loss.md`.

The general rule that came out of it: **a script's name is not evidence of what
it does.** Read it before running it against anything live. `npm test`,
`npm run check`, `npm run verify` and friends are safe in most repos and were
not safe in this one.

## Safe to run freely

```
npm test           typecheck + lint, touches nothing
npm run typecheck
npm run lint
npm run build
npm run dev
npm run test:leads writes two rows to the guest tables and removes them again
```

## Migrations

`supabase/migrations/*.sql` are applied with `npm run db:apply`, which needs a
personal access token in `.supabase-token`. Every file is idempotent and
additive, and must stay that way — `db:apply` re-runs all of them over an
existing project every time.

Never write a migration that drops a column or rewrites data in place.

## Secrets

`.env.local`, `.supabase-token`, `.apikeys.json`, `.credentials.local` and
`credentials.txt` are gitignored and hold live credentials. Do not read them,
print them, or copy their values anywhere. Scripts that need them read them
themselves.

## Stack constraints

- **Tailwind v4** via `@tailwindcss/vite`. There is no `tailwind.config.js` and
  no `postcss.config.js`, and neither should be created. `src/index.css` already
  has the correct `@import`.
- React 19 + TypeScript, `@dnd-kit`, TanStack Query, `vite-plugin-pwa`.
  Supabase is the backend; there is no API layer and no server code.
- No router, no state library, no UI kit. No new dependencies without asking.

## Design system

Colour, type, shape, spacing and motion are CSS custom properties in
`src/index.css`. The light palette is on `:root`; the dark block redefines only
what changes.

**Nothing outside `src/index.css` may contain a raw hex value.** Components
reference `var(--ink)`, `var(--muted)`, `var(--surface)` and so on.

```bash
rg "#[0-9a-fA-F]{3,8}\b" src --glob '!index.css'
```

Hover, focus and completion states also live in `index.css`, because an inline
`background` outranks every rule in that file whatever the layer. A control that
wants a hover state must not carry its own background. `.btn-*`, `.pill`,
`.field`, `.ghost-icon`, `.swatch` and `.switch` supply the colour; inline styles
supply only metrics.

Categories store a palette **slot** (1–15), never a hex. Numbers are tabular
everywhere, so columns align down the page.

## Layout

Breakpoints are measured off the app wrapper, not the viewport. Above 740px the
main column switches between Grid, List and Done while the right rail holds
Deadlines, Habits, Timer and Future; at or below 740px every section is a tab of
its own. `RAIL_TABS` in `src/App.tsx` is the single list of which sections live
in the rail, in the order they appear down it.

## Device-local vs synced

Deliberate, and worth keeping straight:

| State | Where | Why |
|---|---|---|
| Tasks, habits, deadlines, categories, tags | Supabase | the data |
| Future pad text | `user_settings.future_notes` | a list, belongs on every device |
| Future pane collapsed | localStorage | a view preference |
| Timer | localStorage | a stopwatch is about where you are sitting |
| Theme | localStorage | a view preference |
