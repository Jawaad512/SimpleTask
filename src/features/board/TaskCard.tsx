import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import type { TaskRow } from '../../lib/database.types'
import { effectiveMinutes, taskEstimate } from '../../lib/duration'
import { slotColor } from '../../lib/palette'
import { useLayout } from '../../ui/Layout'
import { completionDelay } from '../../ui/motion'
import { TickButton } from './TickButton'

interface TaskCardProps {
  task: TaskRow
  colorSlot: number
  onComplete: (task: TaskRow) => void
  onOpen: (task: TaskRow) => void
}

/** Carry-over stays invisible until it means something. §7: nothing for 0–2. */
export const CARRY_OVER_THRESHOLD = 3

export function TaskCard({ task, colorSlot, onComplete, onOpen }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', taskId: task.id },
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCardBody task={task} colorSlot={colorSlot} onComplete={onComplete} onOpen={onOpen} dragProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

type DragProps = Record<string, unknown> & {
  onKeyDown?: (event: React.KeyboardEvent) => void
}

interface BodyProps extends TaskCardProps {
  dragProps?: DragProps
  lifted?: boolean
}

export function TaskCardBody({ task, colorSlot, onComplete, onOpen, dragProps, lifted }: BodyProps) {
  // The flag nags only while the task is something to do right now.
  const pulsing = task.is_instant && task.is_today

  /**
   * Completion is announced on the card before it is announced to the store:
   * the row leaves the query cache the instant the mutation fires, which would
   * unmount this node mid-animation. So the card plays out first and calls up
   * afterwards — a third of a second, and the undo toast is already waiting.
   */
  const [completing, setCompleting] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function complete() {
    if (completing) return
    setCompleting(true)
    timer.current = window.setTimeout(() => onComplete(task), completionDelay())
  }

  const estimate = taskEstimate(task)
  const minutes = effectiveMinutes(task)
  const { isPhone } = useLayout()

  /* Greyed and tabular: a fact about the task, never a second title. */
  const figure = estimate && (
    <span
      className="t-meta"
      title={
        minutes && minutes >= 5 ? `Estimated ${minutes} minutes` : 'Estimated under five minutes'
      }
      style={{ flexShrink: 0, color: 'var(--muted)', lineHeight: 1.4 }}
    >
      {estimate}
    </span>
  )

  const tick = <TickButton label={`Complete “${task.title}”`} checked={completing} onActivate={complete} />

  return (
    <div
      {...dragProps}
      role="button"
      tabIndex={0}
      onClick={() => !completing && onOpen(task)}
      onKeyDown={(event) => {
        // Space belongs to the keyboard drag; Enter opens the sheet.
        dragProps?.onKeyDown?.(event)
        if (event.defaultPrevented || event.key !== 'Enter') return
        event.preventDefault()
        onOpen(task)
      }}
      className={cn(
        'card',
        // The drag overlay is a copy of a card already on screen, not an
        // arrival, so it does not play the entrance.
        !lifted && 'card-enter',
        task.is_instant && 'instant',
        pulsing && 'now',
        lifted && 'dragging',
        completing && 'completing',
      )}
      style={{
        // The halo in §8 and the completion wash are both drawn from this, so
        // no new colour enters the system.
        ['--cat' as string]: slotColor(colorSlot),
        display: 'flex',
        alignItems: isPhone ? 'flex-start' : 'center',
        gap: 8,
        background: 'var(--surface)',
        border: `${task.habit_id ? '2px dotted' : '2px solid'} ${slotColor(colorSlot)}`,
        borderRadius: 'var(--r-card)',
        padding: '7px 9px',
        cursor: lifted ? 'grabbing' : 'grab',
        boxShadow: lifted ? 'var(--shadow-lift)' : undefined,
      }}
    >
      <span
        className={task.is_instant ? 't-card-title-instant' : 't-card-title'}
        style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}
      >
        {task.title}
      </span>

      {task.carry_over_count >= CARRY_OVER_THRESHOLD && (
        <span
          className="t-meta"
          title={`In today for ${task.carry_over_count} days`}
          style={{
            flexShrink: 0,
            color: 'var(--muted)',
            border: '1px solid var(--hairline-strong)',
            borderRadius: 'var(--r-pill)',
            padding: '1px 6px',
            lineHeight: 1.4,
          }}
        >
          {task.carry_over_count}
        </span>
      )}

      {/* On a phone the estimate tucks in under the tick instead of taking a
          column of its own: the width it gives back is the width the title
          needed to stop wrapping every other word. */}
      {isPhone ? (
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
          }}
        >
          {tick}
          {figure}
        </span>
      ) : (
        <>
          {figure}
          {tick}
        </>
      )}
    </div>
  )
}
