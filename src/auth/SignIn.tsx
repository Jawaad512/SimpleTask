import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Wordmark } from '../ui/Wordmark'
import { useAuth } from './AuthProvider'

type Mode = 'sign-in' | 'create'

export function SignIn() {
  const { enterGuest } = useAuth()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    const credentials = { email: email.trim(), password }
    const { error: authError } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials)

    if (authError) setError(authError.message)
    else if (mode === 'create') setNotice('Account created. Check your inbox if confirmation is on.')

    setBusy(false)
  }

  return (
    <div className="flex min-h-full items-center justify-center" style={{ padding: 16 }}>
      <form
        onSubmit={onSubmit}
        className="w-full"
        style={{
          maxWidth: 320,
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-modal)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <Wordmark />

        <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
          {mode === 'sign-in' ? 'Sign in to your account, or try the guest demo.' : 'Create the single account.'}
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
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span className="t-axis" style={{ color: 'var(--muted)' }}>
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            style={inputStyle}
          />
        </label>

        {error && (
          <p className="t-meta" style={{ color: 'var(--ink)', margin: 0 }}>
            {error}
          </p>
        )}
        {notice && (
          <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="t-control btn btn-primary"
          style={{ borderRadius: 'var(--r-card)', padding: '9px 12px', opacity: busy ? 0.6 : 1 }}
        >
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>

        {mode === 'sign-in' && (
          <button
            type="button"
            className="t-control btn btn-quiet"
            onClick={enterGuest}
            style={{ borderRadius: 'var(--r-card)', padding: '9px 12px' }}
          >
            Guest demo
          </button>
        )}

        <button
          type="button"
          className="t-control-sm row-edit"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'create' : 'sign-in')
            setError(null)
            setNotice(null)
          }}
          style={{ color: 'var(--muted)', textAlign: 'center' }}
        >
          {mode === 'sign-in' ? 'First time? Create the account' : 'Back to sign in'}
        </button>
      </form>
    </div>
  )
}

/* Colour, border and hover live on .field in index.css. Metrics only here. */
const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
}
