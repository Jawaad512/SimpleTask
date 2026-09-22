import { useState, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { CheckIcon } from '../../ui/Icons'

interface TickButtonProps {
  label: string
  /** True while the card plays its completion animation, so the tick stays filled. */
  checked?: boolean
  onActivate: () => void
}

/**
 * Drag starts anywhere else on the card, so the gesture and the tap must never
 * contend for the same pixel: swallow the pointer here before dnd-kit sees it.
 */
export function TickButton({ label, checked = false, onActivate }: TickButtonProps) {
  const [hover, setHover] = useState(false)

  function swallow(event: PointerEvent | React.MouseEvent | React.TouchEvent) {
    event.stopPropagation()
  }

  const filled = checked || hover

  return (
    <button
      type="button"
      className={cn('tick', checked && 'ticked')}
      aria-label={label}
      title={label}
      onPointerDown={swallow}
      onMouseDown={swallow}
      onTouchStart={swallow}
      onClick={(event) => {
        event.stopPropagation()
        onActivate()
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 'var(--r-pill)',
        border: `1px solid ${filled ? 'transparent' : 'var(--hairline-strong)'}`,
        background: filled ? 'var(--ink)' : 'transparent',
        color: filled ? 'var(--canvas)' : 'var(--muted)',
      }}
    >
      <CheckIcon />
    </button>
  )
}
