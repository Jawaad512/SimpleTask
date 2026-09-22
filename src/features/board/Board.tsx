import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import type { CategoryRow, TaskRow } from '../../lib/database.types'
import { effectiveMinutes, formatTotal, isQuickFor, taskEstimate, totalMinutes } from '../../lib/duration'
import { byBandThenPosition, positionBetween } from '../../lib/position'
import { isQuadrantId, quadrantAxes, quadrantId, type QuadrantId } from '../../lib/quadrant'
import { useLayout } from '../../ui/Layout'
import { useToast } from '../../ui/Toast'
import { Quadrant } from './Quadrant'
import { TaskCardBody } from './TaskCard'

interface BoardProps {
  tasks: TaskRow[]
  categories: CategoryRow[]
  onComplete: (task: TaskRow) => void
  onOpen: (task: TaskRow) => void
  onMove: (input: { id: string; isToday: boolean; isQuick: boolean; position: number }) => void
}

const X_MARKERS: Array<{ label: string; quadrant: QuadrantId }> = [
  { label: 'Under 20 min', quadrant: 'today-quick' },
  { label: '20 min +', quadrant: 'today-long' },
]

const Y_MARKERS = ['Today', 'Later']

export function Board({ tasks, categories, onComplete, onOpen, onMove }: BoardProps) {
  const { isPhone } = useLayout()
  const toast = useToast()
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sensors = useSensors(
    // A tap and a drag must never fight for the same gesture.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter is left free so a focused card can open its sheet.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )

  const slotFor = useMemo(() => {
    const bySlot = new Map(categories.map((category) => [category.id, category.color_slot]))
    return (categoryId: string) => bySlot.get(categoryId) ?? 10
  }, [categories])

  const buckets = useMemo(() => {
    const grouped: Record<QuadrantId, TaskRow[]> = {
      'today-quick': [],
      'today-long': [],
      'later-quick': [],
      'later-long': [],
    }
    for (const task of tasks) grouped[quadrantId(task)].push(task)
    for (const key of Object.keys(grouped) as QuadrantId[]) grouped[key].sort(byBandThenPosition)
    return grouped
  }, [tasks])

  const dragging = draggingId ? tasks.find((task) => task.id === draggingId) ?? null : null

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  /** End of the band the task belongs to, inside the given quadrant. */
  function endOfBand(destination: QuadrantId, task: TaskRow): number {
    const siblings = buckets[destination].filter((row) => row.id !== task.id)
    const band = siblings.filter((row) => row.is_instant === task.is_instant)
    return positionBetween(band[band.length - 1]?.position, undefined)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDraggingId(null)
    if (!over) return

    const task = tasks.find((candidate) => candidate.id === String(active.id))
    if (!task) return

    const overId = String(over.id)
    let destination: QuadrantId
    let insertIndex: number

    if (isQuadrantId(overId)) {
      destination = overId
      insertIndex = buckets[destination].filter((row) => row.id !== task.id).length
    } else {
      const overTask = tasks.find((candidate) => candidate.id === overId)
      if (!overTask) return

      destination = quadrantId(overTask)
      const siblings = buckets[destination].filter((row) => row.id !== task.id)
      const overIndex = siblings.findIndex((row) => row.id === overId)
      if (overIndex === -1) return

      const translated = active.rect.current.translated
      const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false
      insertIndex = overIndex + (below ? 1 : 0)
    }

    const axes = quadrantAxes(destination)

    /**
     * An estimate owns the effort axis, so a card carrying one cannot be
     * dragged across the vertical divide — the number on its face would stop
     * being true. The vertical half of the gesture still counts: dragging a
     * 15m card down-and-right moves it to Later and leaves it in the left
     * column, which is what the person was reaching for anyway.
     */
    const estimated = effectiveMinutes(task)
    const lockedQuick = estimated === null ? null : isQuickFor(estimated)

    if (lockedQuick !== null && lockedQuick !== axes.is_quick) {
      const figure = taskEstimate(task)
      toast.showError(
        lockedQuick
          ? `${figure} keeps this in the under-20-min column. Change the estimate to move it.`
          : `${figure} keeps this in the 20-min-plus column. Change the estimate to move it.`,
      )

      if (axes.is_today === task.is_today) return

      const corrected = quadrantId({ is_today: axes.is_today, is_quick: lockedQuick })
      onMove({
        id: task.id,
        isToday: axes.is_today,
        isQuick: lockedQuick,
        position: endOfBand(corrected, task),
      })
      return
    }

    const siblings = buckets[destination].filter((row) => row.id !== task.id)

    // A quadrant floats its under-5-minute cards above the rest, so a position
    // split against a neighbour from the other band would not survive the next
    // sort. Take the neighbours from the dragged card's own band and clamp the
    // drop inside it; the card then lands where it was released.
    const band = siblings.filter((row) => row.is_instant === task.is_instant)
    const bandStart = task.is_instant ? 0 : siblings.length - band.length
    const bandIndex = Math.min(Math.max(insertIndex - bandStart, 0), band.length)

    const before = band[bandIndex - 1]?.position
    const after = band[bandIndex]?.position
    const position = positionBetween(before, after)

    if (axes.is_today === task.is_today && axes.is_quick === task.is_quick && position === task.position) {
      return
    }

    onMove({ id: task.id, isToday: axes.is_today, isQuick: axes.is_quick, position })
  }

  const boardHeight = isPhone ? 412 : 540

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '16px minmax(0, 1fr)',
          gridTemplateRows: 'auto minmax(0, 1fr)',
          columnGap: 6,
          rowGap: 'var(--board-axis-gap)',
        }}
      >
        <div />

        {/* X markers sit above the columns, and carry the hours of estimated
            work standing in the Today row beneath them. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            height: 'var(--board-axis-row)',
            alignItems: 'end',
          }}
        >
          {X_MARKERS.map((marker) => {
            const total = totalMinutes(buckets[marker.quadrant])
            return (
              <span
                key={marker.label}
                className="t-axis"
                style={{
                  color: 'var(--muted)',
                  paddingLeft: 2,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Grouped with the label rather than pushed to the right edge:
                    the two columns sit side by side, and a right-aligned total
                    would read as a prefix to the next column's marker. */}
                <span style={{ whiteSpace: 'nowrap' }}>{marker.label}</span>
                {total > 0 && (
                  <span
                    className="t-meta"
                    title={`Estimated for today, ${marker.label.toLowerCase()}`}
                    style={{
                      flexShrink: 0,
                      color: 'var(--ink)',
                      letterSpacing: 'normal',
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    · {formatTotal(total)}
                  </span>
                )}
              </span>
            )
          })}
        </div>

        {/* Y markers run vertically along the left edge. */}
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 1, height: boardHeight }}>
          {Y_MARKERS.map((marker) => (
            <span
              key={marker}
              className="t-axis"
              style={{
                color: 'var(--muted)',
                writingMode: 'vertical-rl',
                paddingTop: 2,
              }}
            >
              {marker}
            </span>
          ))}
        </div>

        {/* The cross between quadrants is a 1px gap over the axis colour,
            never a border. The grid stays a true 2×2 at every breakpoint. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: 1,
            height: boardHeight,
            background: 'var(--axis-line)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-card)',
            overflow: 'hidden',
          }}
        >
          <Quadrant id="today-quick" tasks={buckets['today-quick']} slotFor={slotFor} onComplete={onComplete} onOpen={onOpen} />
          <Quadrant id="today-long" tasks={buckets['today-long']} slotFor={slotFor} onComplete={onComplete} onOpen={onOpen} />
          <Quadrant id="later-quick" tasks={buckets['later-quick']} slotFor={slotFor} onComplete={onComplete} onOpen={onOpen} />
          <Quadrant id="later-long" tasks={buckets['later-long']} slotFor={slotFor} onComplete={onComplete} onOpen={onOpen} />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <TaskCardBody
            task={dragging}
            colorSlot={slotFor(dragging.category_id)}
            onComplete={() => {}}
            onOpen={() => {}}
            lifted
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
