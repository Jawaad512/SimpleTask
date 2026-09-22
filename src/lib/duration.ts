/**
 * Estimated durations.
 *
 * An estimate is optional: null means the task was never estimated, shows
 * nothing on its card, counts for nothing in the totals, and drags anywhere.
 *
 * Once a task carries a number, that number owns the effort axis rather than
 * merely describing it — under 20 minutes is the left column, under 5 minutes
 * is the flag. The same rule is enforced by the database trigger, so the two
 * can never disagree.
 */

/** Strictly under this is the §8 under-5-minute flag. */
export const INSTANT_MAX = 5

/**
 * What the flag is worth as a number. Ticking "under 5 minutes" is itself an
 * estimate — the band's top whole minute, so a board full of them overstates
 * rather than understates the day.
 */
export const INSTANT_MINUTES = INSTANT_MAX - 1

/** Strictly under this is the left column. */
export const QUICK_MAX = 20

/** A day. Anything longer is not an estimate, it's a project. */
export const DURATION_MAX = 1440

export function isQuickFor(minutes: number): boolean {
  return minutes < QUICK_MAX
}

export function isInstantFor(minutes: number): boolean {
  return minutes < INSTANT_MAX
}

/** Clamps a raw number into the range the column check accepts. */
export function clampMinutes(value: number): number {
  return Math.min(Math.max(Math.round(value), 1), DURATION_MAX)
}

/** '' or anything non-numeric reads as "no estimate", not as zero. */
export function parseMinutes(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value <= 0) return null
  return clampMinutes(value)
}

/**
 * What the card prints. Under five minutes is deliberately not a figure —
 * the point of that band is that the exact number stopped mattering.
 */
export function formatEstimate(minutes: number | null): string | null {
  if (minutes === null) return null
  return isInstantFor(minutes) ? '<5m' : `${minutes}m`
}

/** 'X h XX m' — the shape stays fixed so a column of totals lines up. */
export function formatTotal(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours} h ${String(rest).padStart(2, '0')} m`
}

interface Estimable {
  estimated_minutes: number | null
  is_instant: boolean
}

/**
 * The estimate a task actually carries.
 *
 * The under-5-minute flag *is* a duration — saying a task takes under five
 * minutes is saying how long it takes. So a flagged task always has a number,
 * whether or not one was typed; this is also what keeps rows written before
 * estimates existed showing `<5m` rather than nothing.
 */
export function effectiveMinutes(row: Estimable): number | null {
  if (row.estimated_minutes !== null) return row.estimated_minutes
  return row.is_instant ? INSTANT_MINUTES : null
}

/** What a task's card prints. */
export function taskEstimate(row: Estimable): string | null {
  return formatEstimate(effectiveMinutes(row))
}

/** Sum of the estimates present; tasks without one contribute nothing. */
export function totalMinutes(rows: Estimable[]): number {
  let total = 0
  for (const row of rows) total += effectiveMinutes(row) ?? 0
  return total
}
