import { useMemo, useState, type FormEvent } from 'react'
import { useDeadlineMutations, useDeadlines } from '../../data/useDeadlines'
import { newId } from '../../data/keys'
import { deadlineDisplay, formatDueDate, localDateString } from '../../lib/dates'
import type { DeadlineRow } from '../../lib/database.types'
import { CloseIcon, PlusIcon } from '../../ui/Icons'
import { useToast } from '../../ui/Toast'

/**
 * Prominence comes from typographic scale, not from more colour: a 16px
 * tabular mono numeral against 13.5px titles.
 */
export function DeadlinesPane() {
  const { data: deadlines = [] } = useDeadlines()
  const { add, update, remove, restore } = useDeadlineMutations()
  const toast = useToast()

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...deadlines].sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [deadlines],
  )

  function onRemove(row: DeadlineRow) {
    remove.mutate({ id: row.id })
    toast.showUndo(`Removed “${row.title}”`, () => restore.mutate({ row }))
  }

  return (
    <section style={paneStyle}>
      <header style={headerStyle}>
        <h2 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
          Deadlines
        </h2>
        <button
          type="button"
          className="icon-control"
          onClick={() => {
            setEditingId(null)
            setAdding((value) => !value)
          }}
          aria-expanded={adding}
          aria-label="New deadline"
          style={{ width: 22, height: 22 }}
        >
          <PlusIcon size={11} />
        </button>
      </header>

      {adding && (
        <DeadlineForm
          title=""
          dueDate={localDateString()}
          submitLabel="Add deadline"
          onSubmit={({ title, dueDate }) => {
            add.mutate({ id: newId(), title, dueDate })
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {sorted.length === 0 ? (
        <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
          Nothing due.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((row) => {
            if (row.id === editingId) {
              return (
                <li key={row.id}>
                  <DeadlineForm
                    title={row.title}
                    dueDate={row.due_date}
                    submitLabel="Save"
                    onSubmit={({ title, dueDate }) => {
                      update.mutate({ id: row.id, title, dueDate })
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              )
            }

            const display = deadlineDisplay(row.due_date)

            return (
              <li key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="row-edit"
                  aria-label={`Edit “${row.title}”`}
                  onClick={() => {
                    setAdding(false)
                    setEditingId(row.id)
                  }}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                    }}
                  >
                    <span className="t-deadline-title" style={{ wordBreak: 'break-word' }}>
                      {row.title}
                    </span>
                    <span className="t-meta" style={{ color: 'var(--muted)' }}>
                      {formatDueDate(row.due_date)}
                    </span>
                  </span>

                  <span
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 1,
                    }}
                  >
                    <span className="t-days" style={{ color: 'var(--deadline)' }}>
                      {display.figure}
                    </span>
                    <span className="t-meta" style={{ color: 'var(--muted)' }}>
                      {display.label}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="ghost-icon"
                  aria-label={`Remove “${row.title}”`}
                  onClick={() => onRemove(row)}
                  style={{ flexShrink: 0, width: 22, height: 22 }}
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

interface DeadlineFormProps {
  title: string
  dueDate: string
  submitLabel: string
  onSubmit: (input: { title: string; dueDate: string }) => void
  onCancel: () => void
}

/** Shared by the add row and the in-place editor, so the two cannot drift. */
function DeadlineForm({
  title: initialTitle,
  dueDate: initialDueDate,
  submitLabel,
  onSubmit,
  onCancel,
}: DeadlineFormProps) {
  const [title, setTitle] = useState(initialTitle)
  const [dueDate, setDueDate] = useState(initialDueDate)

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit({ title: trimmed, dueDate })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
        placeholder="What is due"
        aria-label="Deadline title"
        className="t-row-title field"
        style={fieldLayout}
      />
      <input
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
        aria-label="Due date"
        className="t-control-sm field"
        style={fieldLayout}
      />

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

/* The red is the deadline accent. It marks the pane and the days-remaining
   figure, and appears nowhere outside this feature. */
const paneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  background: 'var(--surface)',
  border: '1px solid var(--deadline)',
  borderRadius: 'var(--r-card)',
  padding: 'var(--s-panel)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

/* Colour, border and hover live on .field in index.css. Metrics only here. */
const fieldLayout: React.CSSProperties = {
  padding: '6px 8px',
  width: '100%',
  boxSizing: 'border-box',
}
