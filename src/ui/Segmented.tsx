interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  /** Set when something else owns this axis — an estimate, for instance. */
  disabled?: boolean
  hint?: string
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  hint,
}: SegmentedProps<T>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: disabled ? 0.55 : 1 }}>
      <span className="t-axis" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${options.length}, 1fr)`,
          gap: 2,
          padding: 2,
          background: 'var(--field)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-modal)',
        }}
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className="t-control-sm segment"
              data-on={selected ? 'true' : 'false'}
              style={{ padding: '7px 6px', borderRadius: 7 }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {hint && (
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}
