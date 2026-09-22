/**
 * All day maths is a calendar-date difference in the browser's local time, not
 * a 24-hour difference. A deadline due tomorrow must read "1 day left" at 11pm
 * and still read "1 day left" at 1am the same night.
 */

const MS_PER_DAY = 86_400_000

export function localMidnight(at: Date = new Date()): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate())
}

/** 'YYYY-MM-DD' for the local date, which is what the server is told. */
export function localDateString(at: Date = new Date()): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse a date-only column into local midnight, not UTC midnight. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysUntil(dueDate: string, at: Date = new Date()): number {
  const diff = parseDateOnly(dueDate).getTime() - localMidnight(at).getTime()
  // Rounding absorbs the hour that daylight saving adds or removes.
  return Math.round(diff / MS_PER_DAY)
}

export interface DeadlineDisplay {
  figure: string
  label: string
  overdue: boolean
}

export function deadlineDisplay(dueDate: string, at: Date = new Date()): DeadlineDisplay {
  const n = daysUntil(dueDate, at)

  if (n === 0) return { figure: '—', label: 'today', overdue: false }

  if (n < 0) {
    const over = Math.abs(n)
    return { figure: String(over), label: over === 1 ? 'day over' : 'days over', overdue: true }
  }

  return { figure: String(n), label: n === 1 ? 'day left' : 'days left', overdue: false }
}

const dueDateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export function formatDueDate(dueDate: string): string {
  return dueDateFormat.format(parseDateOnly(dueDate))
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function formatCompletedAt(iso: string): string {
  return timeFormat.format(new Date(iso))
}

export function isWithinLast24Hours(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < MS_PER_DAY
}
