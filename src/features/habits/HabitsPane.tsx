import { useMemo, useState, type FormEvent } from 'react'
import { newId } from '../../data/keys'
import { useHabitMutations, useHabits } from '../../data/useHabits'
import type { CategoryRow, HabitRow, TaskRow } from '../../lib/database.types'
import { DURATION_MAX, formatEstimate, parseMinutes } from '../../lib/duration'
import { slotColor } from '../../lib/palette'
import { EVERY_DAY, WEEKDAYS, WEEKDAYS_ONLY, describeDays, hasDay, toggleDay } from '../../lib/weekdays'
import { CloseIcon, PlusIcon } from '../../ui/Icons'
import { useToast } from '../../ui/Toast'

interface HabitsPaneProps {
  categories: CategoryRow[]
  tasks: TaskRow[]
  onSpawn: (habit: HabitRow) => void
  onClear: (habitId: string) => void
}

/**
 * A habit is a template, not a task. Habit tracking lives outside this app —
 * this pane defines the templates and says which days they place themselves.
 */
export function HabitsPane({ categories, tasks, onSpawn, onClear }: HabitsPaneProps) {
  const { data: habits = [] } = useHabits()
  const { add, update, remove, restore } = useHabitMutations()
  const toast = useToast()

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const today = new Date().getDay()

  const onBoard = useMemo(() => {
    const set = new Set<string>()
    for (const task of tasks) {
      if (task.is_ephemeral && task.status === 'active' && task.habit_id) set.add(task.habit_id)
    }
    return set
  }, [tasks])

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  function onRemove(row: HabitRow) {
    remove.mutate({ id: row.id })
    toast.showUndo(`Removed “${row.title}”`, () => restore.mutate({ row }))
  }

  return (
    <section style={paneStyle}>
      <header style={headerStyle}>
        <h2 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
          Habits
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {onBoard.size} on board
          </span>
          <button
            type="button"
            className="icon-control"
            onClick={() => {
              setEditingId(null)
              setAdding((value) => !value)
            }}
            aria-expanded={adding}
            aria-label="New habit"
            disabled={categories.length === 0}
            style={{ width: 22, height: 22, opacity: categories.length === 0 ? 0.4 : 1 }}
          >
            <PlusIcon size={11} />
          </button>
        </div>
      </header>

      {adding && (
        <HabitForm
          categories={categories}
          title=""
          categoryId={categories[0]?.id ?? ''}
          estimatedMinutes={null}
          days={0}
          submitLabel="Add habit"
          onSubmit={(input) => {
            add.mutate({ id: newId(), position: habits.length, ...input })
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {habits.length === 0 ? (
        <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
          No habits defined.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {habits.map((habit) => {
            if (habit.id === editingId) {
              return (
                <li key={habit.id}>
                  <HabitForm
                    categories={categories}
                    title={habit.title}
                    categoryId={habit.category_id}
                    estimatedMinutes={habit.estimated_minutes}
                    days={habit.days}
                    submitLabel="Save"
                    onSubmit={(input) => {
                      update.mutate({ id: habit.id, ...input })
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              )
            }

            const category = categoryById.get(habit.category_id)
            const on = onBoard.has(habit.id)
            const estimate = formatEstimate(habit.estimated_minutes)

            return (
              <li key={habit.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <button
                  type="button"
                  role="switch"
                  className="switch"
                  aria-checked={on}
                  aria-label={`${on ? 'Remove' : 'Add'} “${habit.title}” ${on ? 'from' : 'to'} the board`}
                  onClick={() => (on ? onClear(habit.id) : onSpawn(habit))}
                  style={{ marginTop: 2 }}
                >
                  <span aria-hidden />
                </button>

                <button
                  type="button"
                  className="row-edit"
                  aria-label={`Edit “${habit.title}”`}
                  onClick={() => {
                    setAdding(false)
                    setEditingId(habit.id)
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 3,
                  }}
                >
                  <span
                    className="t-row-title"
                    style={{ wordBreak: 'break-word', display: 'flex', alignItems: 'baseline', gap: 6 }}
                  >
                    {habit.title}
                    {estimate && (
                      <span className="t-meta" style={{ color: 'var(--muted)' }}>
                        {estimate}
                      </span>
                    )}
                  </span>

                  <span
                    className="t-meta"
                    style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 2,
                        border: `2px solid ${slotColor(category?.color_slot ?? 10)}`,
                      }}
                    />
                    {category?.name ?? 'Unknown'}
                  </span>

                  {/* The schedule, seven columns wide whatever it contains, so
                      a glance down the list compares like with like. */}
                  <span
                    style={{ display: 'flex', gap: 2, marginTop: 1 }}
                    title={describeDays(habit.days)}
                    aria-label={`Scheduled: ${describeDays(habit.days)}`}
                  >
                    {WEEKDAYS.map((day) => (
                      <span
                        key={day.index}
                        aria-hidden
                        className="day-dot"
                        data-on={hasDay(habit.days, day.index) ? 'true' : 'false'}
                        data-today={day.index === today ? 'true' : 'false'}
                      >
                        {day.short}
                      </span>
                    ))}
                  </span>
                </button>

                <button
                  type="button"
                  className="ghost-icon"
                  aria-label={`Remove “${habit.title}”`}
                  onClick={() => onRemove(habit)}
                  style={{ flexShrink: 0, width: 22, height: 22, marginTop: 1 }}
                >
                  <CloseIcon />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

interface HabitFormValue {
  title: string
  categoryId: string
  estimatedMinutes: number | null
  days: number
}

interface HabitFormProps extends HabitFormValue {
  categories: CategoryRow[]
  submitLabel: string
  onSubmit: (input: HabitFormValue) => void
  onCancel: () => void
}

/** Shared by the add row and the in-place editor, so the two cannot drift. */
function HabitForm({
  categories,
  title: initialTitle,
  categoryId: initialCategoryId,
  estimatedMinutes: initialMinutes,
  days: initialDays,
  submitLabel,
  onSubmit,
  onCancel,
}: HabitFormProps) {
  const [title, setTitle] = useState(initialTitle)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [minutes, setMinutes] = useState(initialMinutes === null ? '' : String(initialMinutes))
  const [days, setDays] = useState(initialDays)

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    const category = categoryId || categories[0]?.id
    if (!trimmed || !category) return
    onSubmit({
      title: trimmed,
      categoryId: category,
      estimatedMinutes: parseMinutes(minutes),
      days,
    })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
        placeholder="Habit"
        aria-label="Habit title"
        className="t-row-title field"
        style={fieldLayout}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          aria-label="Category"
          className="t-control-sm field"
          style={{ ...fieldLayout, flex: 1, minWidth: 0 }}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <input
          value={minutes}
          onChange={(event) => setMinutes(event.target.value.replace(/[^0-9]/g, ''))}
          inputMode="numeric"
          maxLength={4}
          max={DURATION_MAX}
          placeholder="min"
          aria-label="Estimated minutes"
          className="t-control-sm field"
          style={{
            flexShrink: 0,
            width: 54,
            padding: '6px 8px',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="t-axis" style={{ color: 'var(--muted)' }}>
          Days
        </span>

        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {WEEKDAYS.map((day) => (
            <button
              key={day.index}
              type="button"
              className="t-control-sm day-chip"
              data-on={hasDay(days, day.index) ? 'true' : 'false'}
              aria-pressed={hasDay(days, day.index)}
              aria-label={day.long}
              title={day.long}
              onClick={() => setDays((value) => toggleDay(value, day.index))}
            >
              {day.short}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="t-meta pill"
            onClick={() => setDays(days === EVERY_DAY ? 0 : EVERY_DAY)}
            style={{ padding: '2px 8px' }}
          >
            Every day
          </button>
          <button
            type="button"
            className="t-meta pill"
            onClick={() => setDays(days === WEEKDAYS_ONLY ? 0 : WEEKDAYS_ONLY)}
            style={{ padding: '2px 8px' }}
          >
            Mon–Fri
          </button>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {days === 0 ? 'Toggle it on by hand' : 'Placed automatically'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="submit"
          className="t-control btn btn-primary"
          disabled={!title.trim()}
          style={{ flex: 1, padding: '6px 12px', opacity: title.trim() ? 1 : 0.35 }}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          className="t-control btn btn-quiet"
          onClick={onCancel}
          style={{ flexShrink: 0, padding: '6px 12px' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/* Ink rather than a hairline, so the pane reads as a peer of the deadline
   pane's red without introducing a colour. */
const paneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  background: 'var(--surface)',
  border: '1px solid var(--ink)',
  borderRadius: 'var(--r-card)',
  padding: 'var(--s-panel)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

/* Colour and border come from .field; only the box metrics live here. */
const fieldLayout: React.CSSProperties = {
  padding: '6px 8px',
  width: '100%',
  boxSizing: 'border-box',
}
