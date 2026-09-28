import { useAuth } from '../../auth/AuthProvider'
import { FUTURE_NOTES_MAX, useFutureNotes } from '../../data/useFutureNotes'
import { ChevronIcon } from '../../ui/Icons'
import { useLayout } from '../../ui/Layout'

/**
 * A scratch pad, not the board. Things land here until they are real enough
 * to become a task — so they stay out of the grid's four squares.
 *
 * The pad is on the row rather than in localStorage, so the phone and the
 * desktop hold the same list. Which means the header has to say so: a pad that
 * is meant to travel needs to admit when it has not travelled yet.
 */
export function FuturePane() {
  const { isPhone } = useLayout()
  const { isGuest } = useAuth()
  const { text, collapsed, setText, setCollapsed, loaded, saving, failed } = useFutureNotes()

  return (
    <section style={paneStyle}>
      <header style={headerStyle}>
        <h2 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
          Future
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* A guest's pad never leaves the browser, so there is nothing to report. */}
          {!isGuest && (
            <span
              className="t-meta"
              style={{ color: failed ? 'var(--deadline)' : 'var(--muted)' }}
              aria-live="polite"
            >
              {!loaded ? '' : failed ? 'Not saved' : saving ? 'Saving…' : 'Synced'}
            </span>
          )}
          <button
            type="button"
            className="icon-control"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Show future notes' : 'Hide future notes'}
            title={collapsed ? 'Show' : 'Hide'}
            onClick={() => setCollapsed(!collapsed)}
            style={{ width: 22, height: 22 }}
          >
            <ChevronIcon direction={collapsed ? 'down' : 'up'} />
          </button>
        </div>
      </header>

      {!collapsed && (
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          /* Typing into an empty box before the server copy arrives would be
             typing into something about to be replaced. */
          disabled={!loaded}
          maxLength={FUTURE_NOTES_MAX}
          placeholder={loaded ? 'Tasks that aren’t ready for the grid yet' : ''}
          aria-label="Future tasks"
          className="t-row-title field thin-scroll"
          style={{
            width: '100%',
            minHeight: isPhone ? '50vh' : 140,
            resize: 'vertical',
            padding: '8px 9px',
            boxSizing: 'border-box',
            lineHeight: 1.45,
          }}
        />
      )}
    </section>
  )
}

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
