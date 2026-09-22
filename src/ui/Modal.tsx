import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './Icons'
import { useLayout } from './Layout'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}

const escapeStack: Array<() => void> = []

/** Centred pane on desktop, full-screen sheet at phone width. Escape closes. */
export function Modal({ title, onClose, children, footer, width = 380 }: ModalProps) {
  const { isPhone } = useLayout()
  const panel = useRef<HTMLDivElement | null>(null)
  const layer = useRef(50 + escapeStack.length)

  useEffect(() => {
    escapeStack.push(onClose)
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (escapeStack[escapeStack.length - 1] !== onClose) return
      event.stopPropagation()
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const index = escapeStack.lastIndexOf(onClose)
      if (index !== -1) escapeStack.splice(index, 1)
    }
  }, [onClose])

  useEffect(() => {
    panel.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: layer.current,
        background: 'color-mix(in srgb, var(--ink) 26%, transparent)',
        display: 'flex',
        alignItems: isPhone ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: isPhone ? 0 : 16,
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          background: 'var(--surface)',
          border: isPhone ? 'none' : '1px solid var(--hairline)',
          borderRadius: isPhone ? 0 : 'var(--r-modal)',
          boxShadow: 'var(--shadow-lift)',
          width: isPhone ? '100%' : width,
          maxHeight: isPhone ? '100%' : 'min(78vh, 640px)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: 'var(--s-panel)',
            borderBottom: '1px solid var(--hairline)',
            flexShrink: 0,
          }}
        >
          <h2 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
            {title}
          </h2>
          <button
            type="button"
            className="ghost-icon"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 26, height: 26, margin: -4 }}
          >
            <CloseIcon size={12} />
          </button>
        </header>

        <div className="thin-scroll" style={{ overflowY: 'auto', padding: 'var(--s-panel)', flex: 1 }}>
          {children}
        </div>

        {footer && (
          <footer
            style={{
              padding: 'var(--s-panel)',
              borderTop: '1px solid var(--hairline)',
              flexShrink: 0,
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
