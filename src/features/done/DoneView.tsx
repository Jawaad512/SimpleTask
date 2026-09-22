import { useMemo } from 'react'
import type { CategoryRow, TaskRow } from '../../lib/database.types'
import { formatCompletedAt, isWithinLast24Hours } from '../../lib/dates'
import { slotColor } from '../../lib/palette'

interface DoneViewProps {
  tasks: TaskRow[]
  categories: CategoryRow[]
  onRestore: (task: TaskRow) => void
}

export function DoneIntro() {
  return (
    <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
      Completed tasks are deleted once they pass 24 hours.
    </p>
  )
}

/** A safety net for accidental completions, not history and not analytics. */
export function DoneView({ tasks, categories, onRestore }: DoneViewProps) {
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const rows = useMemo(
    () =>
      tasks
        .filter((task) => task.status === 'done' && isWithinLast24Hours(task.completed_at))
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.length === 0 ? (
        <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
          Nothing completed in the last 24 hours.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((task) => {
            const category = categoryById.get(task.category_id)

            return (
              <li
                key={task.id}
                className="row-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  borderLeft: `2px solid ${slotColor(category?.color_slot ?? 10)}`,
                  borderRadius: 'var(--r-card)',
                  padding: '8px 10px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span
                    className={task.is_instant ? 't-card-title-instant' : 't-row-title'}
                    style={{ wordBreak: 'break-word', color: 'var(--muted)' }}
                  >
                    {task.title}
                  </span>
                  <span className="t-meta" style={{ color: 'var(--muted)' }}>
                    {task.completed_at ? formatCompletedAt(task.completed_at) : ''}
                  </span>
                </div>

                <button
                  type="button"
                  className="t-control-sm btn btn-quiet"
                  onClick={() => onRestore(task)}
                  style={{ flexShrink: 0, padding: '5px 11px' }}
                >
                  Restore
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
