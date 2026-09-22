# SimpleTask

A single-user personal task app. Tasks are triaged on a 2×2 grid where the
horizontal axis is effort and the vertical axis is whether it's for today.
Re-triage happens by dragging, not by editing fields.

A task may also carry an estimate in minutes. When it does, the estimate owns
the effort axis rather than describing it — see **Estimates** below.

## Stack

React + Vite + TypeScript, Tailwind v4 (CSS-first `@theme`), `@dnd-kit`,
Supabase (Postgres + auth + RLS, no API layer), TanStack Query with optimistic
mutations, `vite-plugin-pwa`. Geist and Geist Mono are self-hosted through
Fontsource so the offline shell keeps its type.

## Setup

```bash
npm install
cp .env.example .env.local     # fill in the two Supabase values
npm run dev
```

### Supabase

Create a project, then apply the schema. With the CLI linked:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push
```

`supabase db push` needs the database password. If you only have a personal
access token — which is the case on a machine without Docker — use the
Management API path instead. It reads the token from `.supabase-token` and the
project ref from `.env.local`:

```bash
npm run db:apply
```

`supabase/migrations` contains five files:

| File | What it does |
|---|---|
| `…_init.sql` | Tables, constraints, and RLS on every table including the join table |
| `…_rollover.sql` | `run_daily_rollover(date)` — carry-over, habit clearing, 24-hour purge |
| `…_rpc.sql` | Category recolour/reorder/delete and tag upsert, each one transaction |
| `…_guest_leads.sql` | `guest_interest` and `guest_feedback`, write-open and owner-read |
| `…_duration_days_slots.sql` | Estimates, habit scheduling days, fifteen colour slots, `rename_tag` |

Every file is idempotent, so `db:apply` can be re-run over an existing project.

Auth is email + password against a single account. Every table is scoped by
`auth.uid() = user_id`; `task_tags` carries no `user_id` of its own and is
policed through its parent task with an `exists` policy.

Supabase pauses free projects after 7 days of no database activity. Daily use
prevents this, and data survives a pause regardless.

## Guest demo

The sign-in screen offers **Guest demo** beside Sign in. A guest gets a seeded
board that lives in that browser's `localStorage` under `simpletask.guest.v1`
and never reaches Supabase — every data hook in `src/data` branches on
`isGuest` before touching the client, and the day rollover is skipped entirely.
So a visitor can drag, complete, tag and delete without an account, and without
being able to see or alter the owner's rows.

Guests also get an **Info** tab, which the owner does not. It explains the
principles and the controls, and offers two forms:

| Button | Table |
|---|---|
| I want this app! | `guest_interest` — one row per unique email |
| Send feedback | `guest_feedback` — a note, email optional |

Both tables are insert-open to `anon` and select-locked to the owner, which
`is_app_owner()` defines as the oldest row in `auth.users`. A guest can leave an
email but cannot read the list, or even count it.

Signed in, the header shows an **_n_ interested** pill. It opens the emails and
the notes, and downloads both as `simpletask-leads.json`. The pill hides itself
rather than showing a broken count if the tables are missing.

```bash
npm run test:leads   # guest may write, owner may read, nobody else
```

Unlike `npm test`, this one touches no task data and removes its own rows, so
it is safe against the live account.

## Estimates

`tasks.estimated_minutes` is nullable. Null is the original behaviour: the card
shows no figure, contributes nothing to the totals, and drags anywhere on the
grid.

Once it holds a number, that number decides the effort axis:

| Estimate | Column | Flag |
|---|---|---|
| under 5 | under 20 min | `is_instant` — shows as `<5m` |
| 5 to 19 | under 20 min | — |
| 20 and up | 20 min + | — |

The relationship runs both ways: the under-5-minute flag *is* an estimate, so
the checkbox in the task sheet writes one (`INSTANT_MINUTES`, the band's top
whole minute) rather than being a second, separate fact. There is one control
for the two, and `effectiveMinutes()` covers rows written before estimates
existed, so a flagged task from the old schema still reads `<5m` and still
counts toward the totals without a data migration.

The rule is enforced in `tasks_normalise_effort()`, not only in the client, so
no write can leave the row disagreeing with the figure printed on the card.
The board refuses a drag across the vertical divide for an estimated task and
keeps the Today/Later half of the gesture; clearing the estimate hands the axis
back to the drag.

The task sheet is an editor: its own fields are a draft until **Save changes**,
so the board does not reshuffle while a number is half typed. Tags are the
deliberate exception — a chip you click is its own commit.

The two figures above the Today row are the sum of the estimates in each of the
top quadrants, in `X h XX m`. Unestimated tasks are simply absent from them, so
a total is a floor rather than a guess.

Habits carry an estimate of their own and pass it to the task they place.

## Habit days

`habits.days` is a seven-bit mask, bit 0 = Sunday, matching `Date#getDay()`.
Zero means the habit only ever goes on the board by hand.

On a scheduled day the habit places itself once. `habits.last_spawn_on` is what
makes that "once": it is stamped on the first placement for a local date and
checked before the next, so taking the habit off the board by hand keeps it off
for the rest of that day rather than having it reappear on the next render.

The placement waits for `useRollover()` to settle and for the task query to be
idle — a rollover deletes every habit instance it finds, including one placed a
moment earlier.

## Design system

Colour, type, shape, spacing and motion live in `src/index.css` as CSS custom
properties. The complete light palette is on `:root`; the dark block redefines
only what changes. There is no in-app theme toggle — dark mode follows the OS.

Nothing outside `src/index.css` may contain a raw hex value:

```bash
rg "#[0-9a-fA-F]{3,8}\b" src --glob '!index.css'
```

Categories store a palette **slot** (1–15), never a hex, so the two themes can
never drift apart. `unique (user_id, color_slot)` is what makes a border colour
unambiguous, and it is why there can be at most fifteen categories.

Hover, focus and completion states live in `index.css` as well, and for the
same reason as the colours: an inline `background` outranks every rule in that
file whatever the layer, so a control that wants a hover state must not carry
one. `.btn-*`, `.pill`, `.field`, `.ghost-icon`, `.swatch` and `.switch` supply
the colour; inline styles supply only metrics.

The splash screen is the one duplication of the tokens, inline in `index.html`,
because it has to paint before the stylesheet exists. `src/ui/splash.ts` takes
it away once auth resolves — it is never a fixed delay.

The deadline accent appears on the days-remaining figure and nowhere else.

## Layout

Breakpoints are measured off the app wrapper, not the viewport, so the
responsive behaviour is testable by resizing that wrapper. Above 740px the main
column switches between Grid, List and Done while the right rail holds
Deadlines and Habits; at or below 740px all five sections are mutually
exclusive. The grid stays a true 2×2 at every width.

## Scripts

| Script | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck and production build, service worker included |
| `npm run typecheck` | `tsc -b` only |
| `npm run lint` | oxlint |
| `npm run icons` | Regenerate `public/icon-*.png` and `favicon.svg` from the glyph |
| `npm run test` | Acceptance checks against the live project (see below) |
| `npm run db:apply` | Apply migrations through the Management API |
| `npm run db:push` | Apply migrations through the CLI (needs the DB password) |

## Acceptance checks

`npm run test` exercises the server-side "done when" criteria: sign-in, RLS
isolation against both a signed-out client and a second signed-in user, the
join-table policy, the colour-slot swap, `on delete restrict`, the
`is_instant` implies `is_quick` trigger, completion leaving the axes untouched,
and rollover idempotency. It creates a throwaway second user for the isolation
checks and deletes it, and it empties the owner account at both ends — so do
not run it against an account holding real tasks.

It reads `.env.local`, `.credentials.local` and `.apikeys.json`, all gitignored.

## Local secrets

None of these are committed:

| File | |
|---|---|
| `.env.local` | Project URL and publishable key, read by Vite |
| `.supabase-token` | Personal access token, used by `db:apply` and `db:query` |
| `.apikeys.json` | Full key list including `service_role` — treat as a secret |
| `.credentials.local` | The single account's email and password |

## Deploying

Live at **https://simpletask-jawaad.vercel.app**.

Vite inlines `VITE_*` values at build time, so the built `dist` is fully
self-contained and can be deployed as a static folder with no environment
configuration on the host:

```bash
npm run build
npx vercel deploy dist --prod
```

The consequence is that a change to `.env.local` needs a rebuild, not just a
redeploy. The key in the bundle is the publishable anon key, which is meant to
be public — RLS is what protects the data, not the key.

If you would rather have the host build from source, point it at build command
`npm run build`, output directory `dist`, and set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` in its environment.
