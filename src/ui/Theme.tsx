import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * Light and dark are one palette with two sets of values, and the switch
 * between them is a single attribute on <html> — index.css keys the dark
 * tokens off `[data-theme='dark']` and nothing else in the app knows which
 * one is on.
 *
 * The inline script in index.html sets that attribute before the first paint,
 * so this provider is only ever agreeing with what is already on screen.
 */

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'simpletask.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

/** A choice the person made and we kept; null means "whatever the system says". */
function storedChoice(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'light' || raw === 'dark' ? raw : null
  } catch {
    // Private mode shouldn't cost the app its theme, only its memory of one.
    return null
  }
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

interface ThemeValue {
  theme: Theme
  /** True while no explicit choice has been made and the system still leads. */
  followsSystem: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeValue>({
  theme: 'light',
  followsSystem: true,
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Theme | null>(() => storedChoice())
  const [system, setSystem] = useState<Theme>(() => systemTheme())

  // Until someone picks a side the system keeps the casting vote, and it can
  // change its mind while the tab is open.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const theme = choice ?? system

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    // The browser chrome follows the canvas. Read back rather than restating
    // the hex: the tokens live in index.css and only there.
    const meta = document.querySelector('meta[name="theme-color"]')
    const canvas = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim()
    if (meta && canvas) meta.setAttribute('content', canvas)
  }, [theme])

  const toggle = useCallback(() => {
    setChoice((current) => {
      const next: Theme = (current ?? systemTheme()) === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // The theme still flips for this session; it just won't be remembered.
      }
      return next
    })
  }, [])

  const value = useMemo<ThemeValue>(
    () => ({ theme, followsSystem: choice === null, toggle }),
    [theme, choice, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext)
}
