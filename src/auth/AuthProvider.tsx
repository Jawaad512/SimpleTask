import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { GUEST_USER_ID } from '../data/guestStore'
import { queryClient } from '../lib/queryClient'
import { supabase } from '../lib/supabase'

const GUEST_FLAG = 'simpletask.guest'

const GUEST_USER = {
  id: GUEST_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'guest@demo.local',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-05-06T00:00:00.000Z',
} as User

interface AuthValue {
  session: Session | null
  user: User | null
  loading: boolean
  isGuest: boolean
  enterGuest: () => void
  exitGuest: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) {
        sessionStorage.removeItem(GUEST_FLAG)
        setIsGuest(false)
      } else {
        setIsGuest(sessionStorage.getItem(GUEST_FLAG) === '1')
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) {
        sessionStorage.removeItem(GUEST_FLAG)
        setIsGuest(false)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? (isGuest ? GUEST_USER : null),
      loading,
      isGuest: isGuest && !session,
      enterGuest: () => {
        queryClient.clear()
        sessionStorage.setItem(GUEST_FLAG, '1')
        setIsGuest(true)
      },
      exitGuest: () => {
        queryClient.clear()
        sessionStorage.removeItem(GUEST_FLAG)
        setIsGuest(false)
      },
      signOut: async () => {
        await supabase.auth.signOut()
        queryClient.clear()
      },
    }),
    [session, loading, isGuest],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export function useUserId(): string {
  const { user } = useAuth()
  if (!user) throw new Error('No signed-in user')
  return user.id
}
