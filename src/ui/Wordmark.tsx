/** The grid, in miniature: four squares, top-left in Ink, the rest Muted. */
function GridGlyph() {
  return (
    <span
      aria-hidden
      className="grid"
      style={{
        width: 15,
        height: 15,
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '1.5px',
      }}
    >
      <span style={{ background: 'var(--ink)' }} />
      <span style={{ background: 'var(--muted)' }} />
      <span style={{ background: 'var(--muted)' }} />
      <span style={{ background: 'var(--muted)' }} />
    </span>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center" style={{ gap: 8 }}>
      <GridGlyph />
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>
        <span style={{ color: 'var(--brand-a)' }}>Simple</span>
        <span style={{ color: 'var(--brand-b)' }}>Task</span>
      </span>
    </span>
  )
}
