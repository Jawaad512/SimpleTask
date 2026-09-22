/**
 * The fifteen category slots. A row stores the slot integer, never a hex, so
 * the light and dark values can never drift apart — both resolve from the same
 * custom property defined in index.css.
 *
 * Slots 11–15 were added to lift the category cap from ten; they fill the gaps
 * the first ten left on the wheel (orange, olive, forest, cyan) plus one
 * low-saturation brown, so no two slots read alike at a 2px border.
 */

export const SLOT_COUNT = 15

export type ColorSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

export const SLOT_NAMES: Record<ColorSlot, string> = {
  1: 'Amber',
  2: 'Lime',
  3: 'Green',
  4: 'Teal',
  5: 'Blue',
  6: 'Indigo',
  7: 'Violet',
  8: 'Fuchsia',
  9: 'Pink',
  10: 'Slate',
  11: 'Rust',
  12: 'Olive',
  13: 'Forest',
  14: 'Cyan',
  15: 'Mocha',
}

export const ALL_SLOTS: ColorSlot[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

/** The CSS custom property that carries this slot's colour in both themes. */
export function slotColor(slot: number): string {
  return `var(--cat-${slot})`
}

export function slotName(slot: number): string {
  return SLOT_NAMES[slot as ColorSlot] ?? `Slot ${slot}`
}
