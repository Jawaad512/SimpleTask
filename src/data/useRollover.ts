import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { localDateString } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { qk } from './keys'

/**
 * §7 — first load of a new local day. The browser owns the notion of "today"
 * and passes it to a single Postgres function; the function decides whether
 * anything actually needs doing, so a slow network can't run it twice.
 *
 * Returns true once the first pass has finished. Anything that puts tasks on
 * the board at start-up has to wait for that, because a rollover deletes every
 * habit instance it finds — including one placed a moment earlier.
 */
export function useRollover(): boolean {
  const { user, isGuest } = useAuth()
  const queryClient = useQueryClient()
  const lastChecked = useRef<string | null>(null)
  const inFlight = useRef(false)
  const [settled, setSettled] = useState(false)

  const check = useCallback(async () => {
    if (!user || isGuest || inFlight.current) return

    const today = localDateString()
    if (lastChecked.current === today) return

    inFlight.current = true
    try {
      const { data, error } = await supabase.rpc('run_daily_rollover', { p_local_date: today })
      if (error) throw error

      lastChecked.current = today

      const result = Array.isArray(data) ? data[0] : data
      if (result?.did_run) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: qk.tasks }),
          queryClient.invalidateQueries({ queryKey: qk.settings }),
        ])
      }
    } catch (error) {
      // A failed rollover is not worth a toast; it retries on the next focus.
      console.error('Rollover failed', error)
    } finally {
      inFlight.current = false
      setSettled(true)
    }
  }, [user, isGuest, queryClient])

  useEffect(() => {
    // A guest has no server-side day boundary, so there is nothing to wait for.
    if (!user || isGuest) {
      setSettled(true)
      return
    }

    void check()

    // Catch the case where the app was left open across midnight.
    function onVisible() {
      if (document.visibilityState === 'visible') void check()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const interval = window.setInterval(() => void check(), 5 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(interval)
    }
  }, [user, isGuest, check])

  return settled
}
