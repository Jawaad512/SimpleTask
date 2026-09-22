import type { CSSProperties } from 'react'
import { downloadLeadsFile, useFeedbackList, useInterestList } from '../../data/useLeads'
import { Modal } from '../../ui/Modal'

interface LeadsPanelProps {
  onClose: () => void
}

export function LeadsPanel({ onClose }: LeadsPanelProps) {
  const interest = useInterestList()
  const feedback = useFeedbackList()

  const emails = interest.data ?? []
  const notes = feedback.data ?? []
  const ready = !interest.isPending && !feedback.isPending
  const failed = interest.isError || feedback.isError

  return (
    <Modal
      title="Interest"
      onClose={onClose}
      width={440}
      footer={
        <button
          type="button"
          className="t-control btn btn-primary"
          disabled={!ready || failed}
          onClick={() => downloadLeadsFile(emails, notes)}
          style={{
            borderRadius: 'var(--r-card)',
            padding: '9px 12px',
            width: '100%',
            opacity: !ready || failed ? 0.6 : 1,
          }}
        >
          Download file
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {failed && (
          <p className="t-meta" style={{ color: 'var(--ink)', margin: 0 }}>
            Couldn’t load the list. The leads tables are not on the project yet.
          </p>
        )}

        {!failed && (
          <>
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
                Emails
              </h3>
              {interest.isPending ? (
                <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
                  Loading…
                </p>
              ) : emails.length === 0 ? (
                <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
                  None yet.
                </p>
              ) : (
                <ul style={listStyle}>
                  {emails.map((row) => (
                    <li key={row.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="t-row-title" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {row.email}
                      </span>
                      <span className="t-meta" style={{ color: 'var(--muted)' }}>
                        {formatWhen(row.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 className="t-section" style={{ margin: 0, color: 'var(--muted)' }}>
                Feedback
              </h3>
              {feedback.isPending ? (
                <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
                  Loading…
                </p>
              ) : notes.length === 0 ? (
                <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
                  None yet.
                </p>
              ) : (
                <ul style={listStyle}>
                  {notes.map((row) => (
                    <li key={row.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="t-card-title" style={{ fontWeight: 400, lineHeight: 1.45 }}>
                        {row.message}
                      </span>
                      <span className="t-meta" style={{ color: 'var(--muted)' }}>
                        {row.email ?? 'No email'} · {formatWhen(row.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  )
}

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

function formatWhen(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  return at.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}
