/**
 * The stopwatch readout.
 *
 * Distinct from `duration.ts`, which is about estimates: an estimate is a whole
 * number of minutes someone typed, while this is elapsed milliseconds counting
 * up. Nothing here rounds to minutes, and nothing here is stored on a task.
 */

const SECOND_MS = 1000
const MINUTE_S = 60
const HOUR_S = 3600

/**
 * `MM:SS` until an hour has passed, then `H:MM:SS`. The minute field keeps its
 * two digits in both shapes, so the string grows by exactly the hour field
 * rather than reflowing the numerals already on screen.
 */
export function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / SECOND_MS)
  const hours = Math.floor(total / HOUR_S)
  const minutes = Math.floor((total % HOUR_S) / MINUTE_S)
  const seconds = total % MINUTE_S

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * The same figure in words, for the screen reader. The readout itself ticks
 * every second, which is no use announced — this is what the control group is
 * labelled with instead.
 */
export function describeElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / SECOND_MS)
  const hours = Math.floor(total / HOUR_S)
  const minutes = Math.floor((total % HOUR_S) / MINUTE_S)
  const seconds = total % MINUTE_S

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`)

  return parts.join(' ')
}
