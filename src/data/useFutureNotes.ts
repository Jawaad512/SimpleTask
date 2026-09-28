import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useToast } from '../ui/Toast'
import { guestFutureNotes, guestSetFutureNotes } from './guestStore'
import { qk } from './keys'

/**
 * The Future pane's scratch pad.
 *
 * The pad itself lives on `user_settings.future_notes`, so the phone and the
 * desktop read the same text. Whether the pane is collapsed does not: that is
 * a view preference belonging to the device you set it on, and it stays in
 * localStorage under the key the pad used to share with it.
 *
 * Writing is debounced rather than per-keystroke, and the local draft outranks
 * the server copy until the write lands — otherwise the focus refetch every
 * other query relies on would overwrite a half-typed line.
 */

/** Collapsed state, and — until it is adopted — the pad written before the sync. */
const LOCAL_PREFIX = 'simpletask.future.v1'

/** Long enough never to be met by hand; matches the column's check constraint. */
export const FUTURE_NOTES_MAX = 20_000

const SAVE_DELAY = 700

type LocalState = {
  collapsed: boolean
  /** Legacy. Present only until the first load has pushed it to the server. */
  text?: string
}

function localKey(userId: string) {
  return `${LOCAL_PREFIX}.${userId}`
}

function readLocal(userId: string): LocalState {
  try {
    const raw = localStorage.getItem(localKey(userId))
    if (!raw) return { collapsed: false }
    const parsed = JSON.parse(raw) as Partial<LocalState>
    return {
      collapsed: Boolean(parsed.collapsed),
      text: typeof parsed.text === 'string' ? parsed.text : undefined,
    }
  } catch {
    return { collapsed: false }
  }
}

function writeLocal(userId: string, value: LocalState) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(value))
  } catch {
    // Private mode or a full store should not take the pane down.
  }
}

export function useFutureNotes() {
  const { user, isGuest } = useAuth()
  const userId = user?.id ?? 'anon'
  const queryClient = useQueryClient()
  const toast = useToast()

  const query = useQuery({
    queryKey: qk.futureNotes,
    enabled: Boolean(user),
    queryFn: async (): Promise<string> => {
      if (isGuest) return guestFutureNotes()

      const { data, error } = await supabase
        .from('user_settings')
        .select('future_notes')
        .maybeSingle()

      if (error) throw error
      // No settings row yet means the rollover has not run; an empty pad, not an error.
      return data?.future_notes ?? ''
    },
  })

  const save = useMutation({
    mutationFn: async (text: string): Promise<string> => {
      if (isGuest) {
        guestSetFutureNotes(text)
        return text
      }

      // Upsert rather than update: the row is created by the rollover, which on
      // a brand-new account may not have run yet. Only this column is sent, so
      // last_rollover_on is never touched.
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, future_notes: text }, { onConflict: 'user_id' })

      if (error) throw error
      return text
    },

    // Seat the result rather than invalidating: a refetch could land before the
    // write is visible and hand back the previous text.
    onSuccess: (text) => queryClient.setQueryData<string>(qk.futureNotes, text),

    onError: () => toast.showError('Couldn’t save your future notes.'),
  })

  /** Non-null while the local text differs from the copy the cache holds. */
  const [draft, setDraft] = useState<string | null>(null)
  const [collapsed, setCollapsedState] = useState(() => readLocal(userId).collapsed)

  /** Typed but not yet sent. */
  const queued = useRef<string | null>(null)
  const timer = useRef<number | null>(null)

  // Both callbacks below are registered as event listeners, so they have to
  // keep one identity for the life of the pane — a flush that changed every
  // render would fire a write from the effect's own cleanup.
  const mutateRef = useRef(save.mutate)
  mutateRef.current = save.mutate

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    const text = queued.current
    if (text === null) return
    queued.current = null
    mutateRef.current(text)
  }, [])

  const setText = useCallback((next: string) => {
    const capped = next.slice(0, FUTURE_NOTES_MAX)
    setDraft(capped)
    queued.current = capped

    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      const text = queued.current
      if (text === null) return
      queued.current = null
      mutateRef.current(text)
    }, SAVE_DELAY)
  }, [])

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next)
      writeLocal(userId, { ...readLocal(userId), collapsed: next })
    },
    [userId],
  )

  // Once the write has landed the draft is redundant, and keeping it would wall
  // this tab off from anything the other device types.
  useEffect(() => {
    if (draft !== null && queued.current === null && query.data === draft) setDraft(null)
  }, [draft, query.data])

  // A different account — or the guest demo — starts from its own pad.
  useEffect(() => {
    queued.current = null
    setDraft(null)
    setCollapsedState(readLocal(userId).collapsed)
  }, [userId])

  // The pad that was written before it synced is still this person's pad. Adopt
  // it once, and only into an empty server copy, so the older of two devices
  // cannot overwrite what the newer one has already saved.
  const adoptedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!query.isSuccess || adoptedFor.current === userId) return
    adoptedFor.current = userId

    const local = readLocal(userId)
    if (!local.text) return

    if (query.data === '') {
      setDraft(local.text)
      mutateRef.current(local.text)
    }
    writeLocal(userId, { collapsed: local.collapsed })
  }, [query.isSuccess, query.data, userId])

  // A closed tab, a backgrounded phone, or a switch to another section must not
  // cost the last few seconds of typing.
  useEffect(() => {
    function onHidden() {
      if (document.visibilityState === 'hidden') flush()
    }

    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flush)

    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  return {
    text: draft ?? query.data ?? '',
    collapsed,
    setText,
    setCollapsed,
    /** False until the server copy is in hand, so the pad cannot be typed over. */
    loaded: query.isSuccess,
    /** A write is queued or in flight. */
    saving: draft !== null,
    /** The last write failed. A toast has already said so. */
    failed: save.isError,
  }
}
