import { useStopwatch } from '../../data/useStopwatch'
import { describeElapsed, formatElapsed } from '../../lib/stopwatch'

/**
 * A stopwatch. It counts up from 00:00 and keeps going; past an hour the
 * readout takes an hour field and becomes H:MM:SS.
 *
 * Prominence comes from typographic scale, the way the deadline figure's does —
 * the largest numeral in the app, mono and tabular, and no colour of its own.
 * At rest it sits in muted; the first tick is what brings it up to ink.
 */
export function TimerPane() {
  const { elapsed, running, start, pause, reset } = useStopwatch()

  const idle = !running && elapsed === 0
  const status = running ? 'Running' : elapsed === 0 ? 'Ready' : 'Paused'

  return (
    <section style={paneStyle}>
      <header style={headerStyle}>
        <h2 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
          Timer
        </h2>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {status}
        </span>
      </header>

      {/* A figure that changes every second is noise to a screen reader, so it
          is not a live region. The label on the controls below carries it. */}
      <p
        role="timer"
        aria-live="off"
        className="t-clock"
        style={{
          margin: 0,
          textAlign: 'center',
          padding: '4px 0 2px',
          color: idle ? 'var(--muted)' : 'var(--ink)',
        }}
      >
        {formatElapsed(elapsed)}
      </p>

      <div
        style={{ display: 'flex', gap: 6 }}
        aria-label={`Timer, ${status.toLowerCase()} at ${describeElapsed(elapsed)}`}
      >
        <button
          type="button"
          className="t-control btn btn-primary"
          onClick={running ? pause : start}
          style={{ flex: 1, padding: '6px 12px' }}
        >
          {running ? 'Pause' : elapsed === 0 ? 'Start' : 'Resume'}
        </button>
        <button
          type="button"
          className="t-control btn btn-quiet"
          onClick={reset}
          disabled={idle}
          style={{ flexShrink: 0, padding: '6px 12px', opacity: idle ? 0.35 : 1 }}
        >
          Reset
        </button>
      </div>
    </section>
  )
}

/* Ink, so the pane reads as a peer of Habits and Future rather than borrowing
   the deadline accent. */
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
