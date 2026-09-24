import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { TaskRow } from '../../lib/database.types'
import { QUADRANT_LABELS, type QuadrantId } from '../../lib/quadrant'
import { TaskCard } from './TaskCard'

interface QuadrantProps {
  id: QuadrantId
  tasks: TaskRow[]
  slotFor: (categoryId: string) => number
  onComplete: (task: TaskRow) => void
  onOpen: (task: TaskRow) => void
}

export function Quadrant({ id, tasks, slotFor, onComplete, onOpen }: QuadrantProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'quadrant', quadrantId: id } })

  return (
    <section
      ref={setNodeRef}
      aria-label={QUADRANT_LABELS[id]}
      className="thin-scroll"
      style={{
        background: isOver ? 'color-mix(in srgb, var(--muted) 8%, var(--canvas))' : 'var(--canvas)',
        padding: 'var(--s-quadrant)',
        overflowY: 'auto',
        overflowX: 'hidden',
        // A quadrant scrolls on its own. Once it reaches its end the gesture
        // stops there rather than carrying on into the page behind the board,
        // which on a phone reads as the whole grid sliding away under a finger
        // that was only trying to reach the last card.
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        minHeight: 0,
        transition: 'background var(--t) var(--ease)',
      }}
    >
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-card-gap)' }}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              colorSlot={slotFor(task.category_id)}
              onComplete={onComplete}
              onOpen={onOpen}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  )
}
