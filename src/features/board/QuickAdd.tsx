import { useState, type FormEvent } from 'react'
import type { CategoryRow } from '../../lib/database.types'
import { DURATION_MAX, parseMinutes } from '../../lib/duration'
import { slotColor } from '../../lib/palette'
import { PlusIcon } from '../../ui/Icons'

interface QuickAddProps {
  categories: CategoryRow[]
  /** Distinguishes "still fetching" from "genuinely no categories". */
  loading?: boolean
  onAdd: (input: { title: string; categoryId: string; estimatedMinutes: number | null }) => void
}

export function QuickAdd({ categories, loading = false, onAdd }: QuickAddProps) {
  const [title, setTitle] = useState('')
  const [chosen, setChosen] = useState('')
  const [minutes, setMinutes] = useState('')

  // Never hold on to a category that went away; fall back to the picker order.
  const categoryId = categories.some((category) => category.id === chosen)
    ? chosen
    : categories[0]?.id ?? ''

  const disabled = categories.length === 0
  const active = categories.find((category) => category.id === categoryId)

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || !categoryId) return

    // An estimate decides which column the task lands in; without one it takes
    // the old default of Today / under 20 minutes.
    onAdd({ title: trimmed, categoryId, estimatedMinutes: parseMinutes(minutes) })
    setTitle('')
    setMinutes('')
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-card)',
        padding: 6,
      }}
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={disabled}
        placeholder={loading ? 'Loading…' : disabled ? 'Create a category first' : 'Add a task'}
        aria-label="Task title"
        style={{
          flex: '1 1 160px',
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '4px 5px',
          fontSize: 13,
          fontWeight: 500,
        }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span
          aria-hidden
          style={{
            width: 9,
            height: 9,
            borderRadius: 2,
            border: `2px solid ${active ? slotColor(active.color_slot) : 'var(--muted)'}`,
          }}
        />
        <select
          value={categoryId}
          onChange={(event) => setChosen(event.target.value)}
          disabled={disabled}
          aria-label="Category"
          className="t-control-sm"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--ink)',
            maxWidth: 110,
          }}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      {/* Optional. Left blank the task is simply unestimated, which is what
          every task in the app was until now. */}
      <input
        value={minutes}
        onChange={(event) => setMinutes(event.target.value.replace(/[^0-9]/g, ''))}
        disabled={disabled}
        inputMode="numeric"
        maxLength={4}
        max={DURATION_MAX}
        placeholder="min"
        aria-label="Estimated minutes"
        title="Estimated minutes — under 20 lands left, under 5 flags it"
        className="t-control-sm field"
        style={{
          flexShrink: 0,
          width: 48,
          padding: '5px 6px',
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      />

      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled || title.trim() === ''}
        aria-label="Add task"
        style={{
          flexShrink: 0,
          width: 26,
          height: 26,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 'var(--r-card)',
          opacity: disabled || title.trim() === '' ? 0.35 : 1,
        }}
      >
        <PlusIcon size={12} />
      </button>
    </form>
  )
}
