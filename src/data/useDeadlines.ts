import { useQuery } from '@tanstack/react-query'
import { useAuth, useUserId } from '../auth/AuthProvider'
import type { DeadlineRow } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import {
  guestDeadlines,
  guestDeleteDeadline,
  guestInsertDeadline,
  guestUpdateDeadline,
} from './guestStore'
import { newId, qk } from './keys'
import { useOptimisticList } from './optimistic'

export function useDeadlines() {
  const { user, isGuest } = useAuth()

  return useQuery({
    queryKey: qk.deadlines,
    enabled: Boolean(user),
    queryFn: async (): Promise<DeadlineRow[]> => {
      if (isGuest) return guestDeadlines()

      const { data, error } = await supabase
        .from('deadlines')
        .select('*')
        .order('due_date', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useDeadlineMutations() {
  const { isGuest } = useAuth()
  const userId = useUserId()

  const add = useOptimisticList<DeadlineRow, { id: string; title: string; dueDate: string }>({
    keys: [qk.deadlines],
    errorMessage: 'Couldn’t save that deadline.',
    apply: (rows, vars) => [
      ...rows,
      {
        id: vars.id,
        user_id: userId,
        title: vars.title,
        due_date: vars.dueDate,
        created_at: new Date().toISOString(),
      },
    ],
    mutationFn: async ({ id, title, dueDate }) => {
      if (isGuest) {
        guestInsertDeadline({
          id,
          user_id: userId,
          title,
          due_date: dueDate,
          created_at: new Date().toISOString(),
        })
        return
      }
      const { error } = await supabase
        .from('deadlines')
        .insert({ id, user_id: userId, title, due_date: dueDate })
      if (error) throw error
    },
  })

  const update = useOptimisticList<DeadlineRow, { id: string; title: string; dueDate: string }>({
    keys: [qk.deadlines],
    errorMessage: 'Couldn’t save that deadline.',
    apply: (rows, vars) =>
      rows.map((row) =>
        row.id === vars.id ? { ...row, title: vars.title, due_date: vars.dueDate } : row,
      ),
    mutationFn: async ({ id, title, dueDate }) => {
      if (isGuest) {
        guestUpdateDeadline(id, { title, due_date: dueDate })
        return
      }
      const { error } = await supabase
        .from('deadlines')
        .update({ title, due_date: dueDate })
        .eq('id', id)
      if (error) throw error
    },
  })

  const remove = useOptimisticList<DeadlineRow, { id: string }>({
    keys: [qk.deadlines],
    errorMessage: 'Couldn’t remove that deadline.',
    apply: (rows, vars) => rows.filter((row) => row.id !== vars.id),
    mutationFn: async ({ id }) => {
      if (isGuest) {
        guestDeleteDeadline(id)
        return
      }
      const { error } = await supabase.from('deadlines').delete().eq('id', id)
      if (error) throw error
    },
  })

  const restore = useOptimisticList<DeadlineRow, { row: DeadlineRow }>({
    keys: [qk.deadlines],
    errorMessage: 'Couldn’t bring that deadline back.',
    apply: (rows, vars) => [...rows.filter((row) => row.id !== vars.row.id), vars.row],
    mutationFn: async ({ row }) => {
      if (isGuest) {
        guestInsertDeadline(row)
        return
      }
      const { error } = await supabase.from('deadlines').insert(row)
      if (error) throw error
    },
  })

  return { add, update, remove, restore, newId }
}
