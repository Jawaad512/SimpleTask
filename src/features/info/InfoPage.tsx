import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { submitFeedback, submitInterest } from '../../data/useLeads'
import { Modal } from '../../ui/Modal'

export function InfoPage() {
  const [interestOpen, setInterestOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
          Info
        </h1>
        <p className="t-row-title" style={{ margin: 0, lineHeight: 1.5 }}>
          SimpleTask is a private 2×2 to-do grid that simplifies work
          prioritization. This is a demo of the app.
        </p>
      </header>

      <section style={sectionStyle}>
        <h2 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
          Principles
        </h2>
        <ul style={listStyle}>
          <InfoItem title="Most to-do apps are too complicated.">
            For most of us, 80% of task accountability takes place when two
            questions are asked: Is the task for today? And can the task be done
            quickly? Those two facts place a task on the grid.
          </InfoItem>
          <InfoItem title="Simple re-triage by dragging.">
            Moving a card between squares is the edit. You do not need to edit
            extensively.
          </InfoItem>
          <InfoItem title="Under five minutes is a flag, not a third axis.">
            The most common anti-procrastination advice: “If it takes less than
            five minutes, do it right away.” Sub-five minute tasks are also the
            quickest hits of dopamine throughout the day: Cleaning the table,
            making the bed, even a cold call. You deserve a system that
            highlights those tasks.
          </InfoItem>
          <InfoItem title="Simple colors, simpler categorization.">
            At most fifteen categories, each bound to a fixed colour slot, all of
            them renameable and recolourable. Tags cut across categories and are
            editable in the same way.
          </InfoItem>
          <InfoItem title="An estimate, not a schedule.">
            Give a task a number of minutes and it shows on the card — 15m, 45m,
            or just <em>&lt;5m</em>. The number decides which column the task
            belongs in, so the grid and the estimate can never disagree, and the
            two figures above the top row tell you how long today actually is.
          </InfoItem>
          <InfoItem title="Habits are templates.">
            Habit-tracking can be super simple — if it’s something as quick as ten
            minutes of meditation, you toggle it on, and it sits on your board for
            the day. Pick the days a habit runs and it places itself. Deadlines
            are calendar dates that never mix into the grid. It’s important to
            have an eye on those until it’s too late.
          </InfoItem>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
          How to use
        </h2>
        <ul style={listStyle}>
          <InfoItem title="Add from the top of the grid.">
            Quick-add lands a task in Today; the minutes box decides the column.
            Open the card to change the estimate, tag it, or delete it.
          </InfoItem>
          <InfoItem title="Tick to complete.">
            Undo is offered for a few seconds. The Done tab holds the last day of
            completions if you need one back.
          </InfoItem>
          <InfoItem title="List is for scanning.">
            Filter by category and tag. The × on a pill deletes it; the pencil
            beside the row opens the manager, where both can be renamed.
          </InfoItem>
          <InfoItem title="Deadlines and habits sit to the side.">
            On a wide screen, they stay in the right rail. On a phone they are
            their own tabs, mutually exclusive with the grid.
          </InfoItem>
          <InfoItem title="This demo stays on this device.">
            Refresh keeps your edits. Leaving the demo and coming back later
            still finds them here. They are never written to the author’s board.
          </InfoItem>
        </ul>
      </section>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className="t-control btn btn-primary"
          style={buttonBox}
          onClick={() => setInterestOpen(true)}
        >
          I want this app!
        </button>
        <button
          type="button"
          className="t-control btn btn-quiet"
          style={buttonBox}
          onClick={() => setFeedbackOpen(true)}
        >
          Send feedback
        </button>
      </section>

      {interestOpen && <InterestModal onClose={() => setInterestOpen(false)} />}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  )
}

function InfoItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="t-row-title">{title}</span>
      <span className="t-card-title" style={{ color: 'var(--muted)', fontWeight: 400, lineHeight: 1.5 }}>
        {children}
      </span>
    </li>
  )
}

function InterestModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await submitInterest(email)
      setDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save that email.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="I want this app!" onClose={onClose}>
      {done ? (
        <p className="t-row-title" style={{ margin: 0, lineHeight: 1.5 }}>
          Thanks for expressing interest! We will reach out if the app is expanded
          for public use.
        </p>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="t-card-title" style={{ margin: 0, color: 'var(--muted)', fontWeight: 400, lineHeight: 1.5 }}>
            Leave an email if you would use a public version of SimpleTask. This
            is not an account, and it does not sign you in.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="t-axis" style={{ color: 'var(--muted)' }}>
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
              style={inputStyle}
            />
          </label>
          {error && (
            <p className="t-meta" style={{ color: 'var(--ink)', margin: 0 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="t-control btn btn-primary"
            style={{ ...buttonBox, opacity: busy ? 0.6 : 1 }}
          >
            I want this app!
          </button>
        </form>
      )}
    </Modal>
  )
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await submitFeedback(message, email)
      setDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save that note.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Feedback" onClose={onClose}>
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="t-row-title" style={{ margin: 0, lineHeight: 1.5 }}>
            Thanks — that note is with the author.
          </p>
          <button
            type="button"
            className="t-control-sm row-edit"
            onClick={() => {
              setMessage('')
              setDone(false)
            }}
            style={{ color: 'var(--muted)', textAlign: 'left', alignSelf: 'flex-start' }}
          >
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="t-axis" style={{ color: 'var(--muted)' }}>
              Note
            </span>
            <textarea
              required
              minLength={1}
              maxLength={2000}
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="field"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="t-axis" style={{ color: 'var(--muted)' }}>
              Email, optional
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
              style={inputStyle}
            />
          </label>
          {error && (
            <p className="t-meta" style={{ color: 'var(--ink)', margin: 0 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="t-control btn btn-primary"
            style={{ ...buttonBox, opacity: busy ? 0.6 : 1 }}
          >
            Send feedback
          </button>
        </form>
      )}
    </Modal>
  )
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

/* Colour, border and hover live on .field and .btn-* in index.css. */
const inputStyle: CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}

const buttonBox: CSSProperties = {
  borderRadius: 'var(--r-card)',
  padding: '9px 12px',
}
