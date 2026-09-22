import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * Breakpoints are measured off the app wrapper, not the viewport, so the
 * responsive behaviour can be tested by resizing that wrapper.
 */

export const PHONE_MAX = 740

interface LayoutValue {
  width: number
  isPhone: boolean
}

const LayoutContext = createContext<LayoutValue>({ width: PHONE_MAX + 1, isPhone: false })

export function LayoutProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState<number>(() =>
    typeof window === 'undefined' ? PHONE_MAX + 1 : window.innerWidth,
  )

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })

    observer.observe(element)
    setWidth(element.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [])

  const value = useMemo<LayoutValue>(() => ({ width, isPhone: width <= PHONE_MAX }), [width])

  return (
    <LayoutContext.Provider value={value}>
      <div
        ref={ref}
        style={{
          containerType: 'inline-size',
          containerName: 'app',
          width: '100%',
          minHeight: '100%',
        }}
      >
        {children}
      </div>
    </LayoutContext.Provider>
  )
}

export function useLayout(): LayoutValue {
  return useContext(LayoutContext)
}
