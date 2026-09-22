import { useFutureNotes } from '../../data/useFutureNotes'
import { ChevronIcon } from '../../ui/Icons'
import { useLayout } from '../../ui/Layout'

/**
 * A scratch pad, not the board. Things land here until they are real enough
 * to become a task — so they stay out of the grid's four squares.
 */
export function FuturePane() {
  const { isPhone } = useLayout()
  const { text, collapsed, setText, setCollapsed } = useFutureNotes()

  return (
    <section style={paneStyle}>
      <header style={headerStyle}>
        <h2 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
          Future
        </h2>
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
      </header>

      {!collapsed && (
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Tasks that aren’t ready for the grid yet"
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
