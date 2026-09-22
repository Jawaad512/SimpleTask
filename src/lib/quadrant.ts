/**
 * The grid is a view, not a container. A quadrant id is a pair of booleans
 * serialised for dnd-kit; nothing is stored under this name.
 *
 *   X negative = under 20 minutes (is_quick)      X positive = 20 min +
 *   Y positive = today (is_today)                 Y negative = later
 */

export type QuadrantId = 'today-quick' | 'today-long' | 'later-quick' | 'later-long'

export const QUADRANT_ORDER: QuadrantId[] = [
  'today-quick',
  'today-long',
  'later-quick',
  'later-long',
]

export interface Axes {
  is_today: boolean
  is_quick: boolean
}

export function quadrantId({ is_today, is_quick }: Axes): QuadrantId {
  if (is_today) return is_quick ? 'today-quick' : 'today-long'
  return is_quick ? 'later-quick' : 'later-long'
}

export function quadrantAxes(id: QuadrantId): Axes {
  return {
    is_today: id === 'today-quick' || id === 'today-long',
    is_quick: id === 'today-quick' || id === 'later-quick',
  }
}

export function isQuadrantId(value: string): value is QuadrantId {
  return (QUADRANT_ORDER as string[]).includes(value)
}

/** Only used for screen readers — the visible board is deliberately unlabelled. */
export const QUADRANT_LABELS: Record<QuadrantId, string> = {
  'today-quick': 'Today, under 20 minutes',
  'today-long': 'Today, 20 minutes or more',
  'later-quick': 'Later, under 20 minutes',
  'later-long': 'Later, 20 minutes or more',
}
