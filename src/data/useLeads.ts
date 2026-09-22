import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import type { GuestFeedbackRow, GuestInterestRow } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import { qk } from './keys'

function leadError(error: { code?: string; message: string }, fallback: string) {
  if (error.code === '23505') return 'That email is already on the list.'
  if (error.code === '23514') return 'That doesn’t look like a usable value.'
  if (error.code === 'PGRST205' || /schema cache|does not exist/i.test(error.message)) {
    return 'This isn’t live on the project yet.'
  }
  return error.message || fallback
}

export function useInterestCount() {
  const { session, isGuest } = useAuth()

  return useQuery({
    queryKey: qk.interest,
    enabled: Boolean(session) && !isGuest,
    retry: false,
    queryFn: async (): Promise<number> => {
      const { count, error, status } = await supabase
        .from('guest_interest')
        .select('*', { count: 'exact', head: true })
      if (error || status >= 400) throw error ?? new Error('Couldn’t read interest count.')
      return count ?? 0
    },
  })
}

export function useInterestList() {
  const { session, isGuest } = useAuth()

  return useQuery({
    queryKey: [...qk.interest, 'list'] as const,
    enabled: Boolean(session) && !isGuest,
    retry: false,
    queryFn: async (): Promise<GuestInterestRow[]> => {
      const { data, error } = await supabase
        .from('guest_interest')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useFeedbackList() {
  const { session, isGuest } = useAuth()

  return useQuery({
    queryKey: qk.feedback,
    enabled: Boolean(session) && !isGuest,
    retry: false,
    queryFn: async (): Promise<GuestFeedbackRow[]> => {
      const { data, error } = await supabase
        .from('guest_feedback')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export async function submitInterest(email: string): Promise<void> {
  const { error } = await supabase.from('guest_interest').insert({ email: email.trim().toLowerCase() })
  if (error) throw new Error(leadError(error, 'Couldn’t save that email.'))
}

export async function submitFeedback(message: string, email: string): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase()
  const { error } = await supabase.from('guest_feedback').insert({
    message: message.trim(),
    email: trimmedEmail ? trimmedEmail : null,
  })
  if (error) throw new Error(leadError(error, 'Couldn’t save that note.'))
}

export function downloadLeadsFile(interest: GuestInterestRow[], feedback: GuestFeedbackRow[]) {
  const payload = {
    generated_at: new Date().toISOString(),
    interest_count: interest.length,
    emails: interest.map((row) => ({ email: row.email, created_at: row.created_at })),
    feedback: feedback.map((row) => ({
      message: row.message,
      email: row.email,
      created_at: row.created_at,
    })),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'simpletask-leads.json'
  link.click()
  URL.revokeObjectURL(url)
}
