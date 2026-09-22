import { ALL_SLOTS, slotColor, slotName } from '../../lib/palette'

interface SlotPickerProps {
  value: number | null
  /** slot -> the category that already owns it */
  takenBy: Map<number, string>
  /** A recolour may pick a taken slot; the two categories swap. */
  allowSwap?: boolean
  onPick: (slot: number) => void
}

export function SlotPicker({ value, takenBy, allowSwap = false, onPick }: SlotPickerProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {ALL_SLOTS.map((slot) => {
        const owner = takenBy.get(slot)
        const selected = value === slot
        const disabled = Boolean(owner) && !selected && !allowSwap

        const label = owner
          ? `${slotName(slot)} — ${owner}${allowSwap && !selected ? ' (swap)' : ''}`
          : slotName(slot)

        return (
          <button
            key={slot}
            type="button"
            className="swatch"
            title={label}
            aria-label={label}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onPick(slot)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 'var(--r-card)',
              border: `2px solid ${slotColor(slot)}`,
              background: selected ? slotColor(slot) : 'var(--surface)',
              opacity: disabled ? 0.28 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          />
        )
      })}
    </div>
  )
}
