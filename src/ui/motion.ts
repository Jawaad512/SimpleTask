/** Kept in step with --t-slow in index.css. */
export const COMPLETE_MS = 300

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * How long to let a completion animation run before the row actually leaves
 * the list. Someone who has asked for less motion should not also be asked to
 * wait for it.
 */
export function completionDelay(): number {
  return prefersReducedMotion() ? 0 : COMPLETE_MS
}
