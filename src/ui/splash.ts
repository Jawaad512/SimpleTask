/**
 * The splash markup lives in index.html so it paints before the bundle does.
 * This is the only thing that takes it away, and it is called once the app
 * knows whether it has a session — so the wait is the real wait, never a
 * decorative timeout.
 */
export function dismissSplash() {
  const node = document.getElementById('splash')
  if (!node || node.dataset.leaving === 'true') return

  node.dataset.leaving = 'true'
  node.addEventListener('transitionend', () => node.remove(), { once: true })

  // transitionend does not fire if the element was never painted, or if the
  // user has motion reduced to the point of no transition at all.
  window.setTimeout(() => node.remove(), 600)

  // One frame, so the browser has a value to transition away from.
  requestAnimationFrame(() => node.classList.add('is-leaving'))
}
