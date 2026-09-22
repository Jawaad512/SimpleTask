/**
 * Fractional indexing. A drop rewrites one row's position by splitting the gap
 * between its two new neighbours, so a reorder never renumbers the quadrant.
 */

export const POSITION_STEP = 1024

/** Smallest gap worth splitting before the doubles start losing precision. */
const MIN_GAP = 1e-6

export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return POSITION_STEP
  if (before === undefined) return after! - POSITION_STEP
  if (after === undefined) return before + POSITION_STEP
  return (before + after) / 2
}

export function needsRebalance(before?: number, after?: number): boolean {
  if (before === undefined || after === undefined) return false
  return Math.abs(after - before) < MIN_GAP
}

/** Position for a task appended to the end of a quadrant. */
export function appendPosition(positions: number[]): number {
  if (positions.length === 0) return POSITION_STEP
  return Math.max(...positions) + POSITION_STEP
}

export function byPosition<T extends { position: number; created_at: string }>(a: T, b: T): number {
  if (a.position !== b.position) return a.position - b.position
  return a.created_at.localeCompare(b.created_at)
}

/**
 * Board order. Under-5-minute work floats to the top of its quadrant and
 * position orders within that band, so the two bands reorder independently —
 * see the drag handler in Board, which keeps a drop inside its own band.
 */
export function byBandThenPosition<
  T extends { is_instant: boolean; position: number; created_at: string },
>(a: T, b: T): number {
  if (a.is_instant !== b.is_instant) return a.is_instant ? -1 : 1
  return byPosition(a, b)
}
