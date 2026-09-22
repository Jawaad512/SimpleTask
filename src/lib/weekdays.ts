/**
 * Habit scheduling days.
 *
 * A habit stores a seven-bit mask rather than a list, so the whole schedule is
 * one integer column and comparing it against `Date#getDay()` needs no parsing.
 * Bit 0 is Sunday through bit 6 Saturday, matching the browser.
 *
 * Zero means the habit places itself on no day at all — the toggle still works
 * by hand, which is exactly how every habit behaved before this existed.
 */

export const WEEKDAYS: Array<{ index: number; short: string; long: string }> = [
  { index: 0, short: 'S', long: 'Sunday' },
  { index: 1, short: 'M', long: 'Monday' },
  { index: 2, short: 'T', long: 'Tuesday' },
  { index: 3, short: 'W', long: 'Wednesday' },
  { index: 4, short: 'T', long: 'Thursday' },
  { index: 5, short: 'F', long: 'Friday' },
  { index: 6, short: 'S', long: 'Saturday' },
]

export const EVERY_DAY = 0b1111111
export const WEEKDAYS_ONLY = 0b0111110

export function hasDay(mask: number, day: number): boolean {
  return ((mask >> day) & 1) === 1
}

export function toggleDay(mask: number, day: number): number {
  return mask ^ (1 << day)
}

export function dayCount(mask: number): number {
  let count = 0
  for (let day = 0; day < 7; day += 1) if (hasDay(mask, day)) count += 1
  return count
}

/** Short prose for the line under a habit: 'Every day', 'Mon–Fri', 'Mon, Thu'. */
export function describeDays(mask: number): string {
  if (mask === 0) return 'Manual only'
  if (mask === EVERY_DAY) return 'Every day'
  if (mask === WEEKDAYS_ONLY) return 'Mon–Fri'

  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const picked: string[] = []
  for (let day = 0; day < 7; day += 1) if (hasDay(mask, day)) picked.push(names[day])
  return picked.join(', ')
}
