import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

/**
 * A count-up timer, not a countdown, and not a task.
 *
 * It stays on the device. A stopwatch answers "how long have I been at this, at
 * this desk" — a second device picking up a running clock would be reporting
 * something it was not present for. That is the opposite of the Future pad,
 * which is a list and does belong on the row.
 *
 * What is persisted is the start *instant*, never a running total, so the clock
 * is correct after a reload, after a phone locks, and after the pane unmounts —
 * which it does every time a phone switches section.
 */

const PREFIX = 'simpletask.timer.v1'

/** Four times a second. The readout is to the second; this keeps it honest. */
const TICK_MS = 250

type Persisted = {
  /** Epoch ms the current run began, or null while paused. */
  startedAt: number | null
  /** Milliseconds banked by earlier runs. */
  accumulated: number
}

const STOPPED: Persisted = { startedAt: null, accumulated: 0 }

function storageKey(userId: string) {
  return `${PREFIX}.${userId}`
}

function read(userId: string): Persisted {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return STOPPED
    const parsed = JSON.parse(raw) as Partial<Persisted>
    return {
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
      accumulated:
        typeof parsed.accumulated === 'number' && parsed.accumulated >= 0 ? parsed.accumulated : 0,
    }
  } catch {
    return STOPPED
  }
}

function write(userId: string, value: Persisted) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(value))
  } catch {
    // Private mode or a full store should not take the timer down.
  }
}

/** Wall-clock since the run began. Guarded, so a clock set backwards reads zero. */
function sinceStart(state: Persisted, now: number): number {
  return state.startedAt === null ? 0 : Math.max(0, now - state.startedAt)
}

export function useStopwatch() {
  const { user } = useAuth()
  const userId = user?.id ?? 'anon'

  const [state, setState] = useState<Persisted>(() => read(userId))
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setState(read(userId))
  }, [userId])

  // Only while it is running, and only to move the readout on — the elapsed
  // figure is derived from the timestamps, so a missed tick loses nothing.
  useEffect(() => {
    if (state.startedAt === null) return

    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(id)
  }, [state.startedAt])

  const apply = useCallback(
    (patch: (current: Persisted) => Persisted) => {
      setState((current) => {
        const next = patch(current)
        write(userId, next)
        return next
      })
    },
    [userId],
  )

  // The instant is taken out here rather than inside the patch, so the patch
  // stays pure and a double-invoked update cannot read two different clocks.
  const start = useCallback(() => {
    const at = Date.now()
    apply((current) => (current.startedAt === null ? { ...current, startedAt: at } : current))
  }, [apply])

  const pause = useCallback(() => {
    const at = Date.now()
    apply((current) =>
      current.startedAt === null
        ? current
        : { startedAt: null, accumulated: current.accumulated + sinceStart(current, at) },
    )
  }, [apply])

  const reset = useCallback(() => apply(() => STOPPED), [apply])

  return {
    elapsed: state.accumulated + sinceStart(state, now),
    running: state.startedAt !== null,
    start,
    pause,
    reset,
  }
}
