import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * One toast component, one toast at a time. Every undoable action routes
 * through here: message, Undo button, five-second progress line.
 */

export const TOAST_MS = 5000

interface ToastState {
  id: number
  message: string
  onUndo?: () => void
}

interface ToastApi {
  /** An undoable action. The window is five seconds. */
  showUndo: (message: string, onUndo: () => void) => void
  /** A write that failed. Plain language, says what didn't save. */
  showError: (message: string) => void
  dismiss: () => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const nextId = useRef(0)

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current)
      timer.current = undefined
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [clearTimer])

  const push = useCallback(
    (next: Omit<ToastState, 'id'>) => {
      clearTimer()
      const id = ++nextId.current
      setToast({ ...next, id })
      timer.current = window.setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current))
      }, TOAST_MS)
    },
    [clearTimer],
  )

  const api = useMemo<ToastApi>(
    () => ({
      showUndo: (message, onUndo) => push({ message, onUndo }),
      showError: (message) => push({ message }),
      dismiss,
    }),
    [push, dismiss],
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  useEffect(() => {
    if (!toast) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toast, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          key={toast.id}
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 20,
            transform: 'translateX(-50%)',
            zIndex: 60,
            width: 'calc(100% - 32px)',
            maxWidth: 360,
            background: 'var(--surface)',
            border: '1px solid var(--hairline-strong)',
            borderRadius: 'var(--r-modal)',
            boxShadow: 'var(--shadow-lift)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 12px',
            }}
          >
            <span className="t-row-title" style={{ color: 'var(--ink)' }}>
              {toast.message}
            </span>

            {toast.onUndo ? (
              <button
                type="button"
                className="t-control-sm btn btn-quiet"
                onClick={() => {
                  const undo = toast.onUndo
                  dismiss()
                  undo?.()
                }}
                style={{ padding: '4px 10px', flexShrink: 0 }}
              >
                Undo
              </button>
            ) : (
              <button
                type="button"
                className="ghost-icon"
                onClick={dismiss}
                aria-label="Dismiss"
                style={{ width: 24, height: 24, flexShrink: 0 }}
              >
                ×
              </button>
            )}
          </div>

          <div style={{ height: 2, background: 'var(--hairline)' }}>
            <div
              style={{
                height: '100%',
                background: 'var(--muted)',
                animation: `toast-drain ${TOAST_MS}ms linear forwards`,
              }}
            />
          </div>

          <style>{'@keyframes toast-drain { from { width: 100%; } to { width: 0%; } }'}</style>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}
