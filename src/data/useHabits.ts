import { useQuery } from '@tanstack/react-query'
import { useAuth, useUserId } from '../auth/AuthProvider'
import type { HabitRow } from '../lib/database.types'
import { isQuickFor } from '../lib/duration'
import { supabase } from '../lib/supabase'
import {
  guestDeleteHabit,
  guestHabits,
  guestInsertHabit,
  guestUpdateHabit,
} from './guestStore'
import { newId, qk } from './keys'
import { useOptimisticList } from './optimistic'

export function useHabits() {
  const { user, isGuest } = useAuth()

  return useQuery({
    queryKey: qk.habits,
    enabled: Boolean(user),
    queryFn: async (): Promise<HabitRow[]> => {
      if (isGuest) return guestHabits()

      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export interface HabitInput {
  title: string
  categoryId: string
  estimatedMinutes: number | null
  /** Seven-bit mask; 0 keeps the habit manual. */
  days: number
}

/** A habit's estimate settles its column the same way a task's does. */
function quickFor(minutes: number | null): boolean {
  return minutes === null ? true : isQuickFor(minutes)
}

export function useHabitMutations() {
  const { isGuest } = useAuth()
  const userId = useUserId()

  const add = useOptimisticList<HabitRow, HabitInput & { id: string; position: number }>({
    keys: [qk.habits],
    errorMessage: 'Couldn’t save that habit.',
    apply: (rows, vars) => [
      ...rows,
      {
        id: vars.id,
        user_id: userId,
        title: vars.title,
        category_id: vars.categoryId,
        is_quick: quickFor(vars.estimatedMinutes),
        estimated_minutes: vars.estimatedMinutes,
        days: vars.days,
        last_spawn_on: null,
        position: vars.position,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    mutationFn: async ({ id, title, categoryId, estimatedMinutes, days, position }) => {
      const row: HabitRow = {
        id,
        user_id: userId,
        title,
        category_id: categoryId,
        is_quick: quickFor(estimatedMinutes),
        estimated_minutes: estimatedMinutes,
        days,
        last_spawn_on: null,
        position,
        is_active: true,
        created_at: new Date().toISOString(),
      }

      if (isGuest) {
        guestInsertHabit(row)
        return
      }

      const { error } = await supabase.from('habits').insert({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        category_id: row.category_id,
        is_quick: row.is_quick,
        estimated_minutes: row.estimated_minutes,
        days: row.days,
        position: row.position,
      })
      if (error) throw error
    },
  })

  const update = useOptimisticList<HabitRow, HabitInput & { id: string }>({
    keys: [qk.habits],
    errorMessage: 'Couldn’t save that habit.',
    apply: (rows, vars) =>
      rows.map((row) =>
        row.id === vars.id
          ? {
              ...row,
              title: vars.title,
              category_id: vars.categoryId,
              estimated_minutes: vars.estimatedMinutes,
              is_quick: quickFor(vars.estimatedMinutes),
              days: vars.days,
            }
          : row,
      ),
    mutationFn: async ({ id, title, categoryId, estimatedMinutes, days }) => {
      const patch = {
        title,
        category_id: categoryId,
        estimated_minutes: estimatedMinutes,
        is_quick: quickFor(estimatedMinutes),
        days,
      }
      if (isGuest) {
        guestUpdateHabit(id, patch)
        return
      }
      const { error } = await supabase.from('habits').update(patch).eq('id', id)
      if (error) throw error
    },
  })

  /**
   * Stamped once the habit has placed itself for a local date. It is what
   * makes the auto-placement idempotent, so taking a habit off the board by
   * hand keeps it off for the rest of that day.
   */
  const markSpawned = useOptimisticList<HabitRow, { id: string; date: string }>({
    keys: [qk.habits],
    errorMessage: 'Couldn’t record today’s habit.',
    apply: (rows, vars) =>
      rows.map((row) => (row.id === vars.id ? { ...row, last_spawn_on: vars.date } : row)),
    mutationFn: async ({ id, date }) => {
      if (isGuest) {
        guestUpdateHabit(id, { last_spawn_on: date })
        return
      }
      const { error } = await supabase.from('habits').update({ last_spawn_on: date }).eq('id', id)
      if (error) throw error
    },
  })

  const remove = useOptimisticList<HabitRow, { id: string }>({
    keys: [qk.habits, qk.tasks],
    errorMessage: 'Couldn’t remove that habit.',
    apply: (rows, vars) => rows.filter((row) => row.id !== vars.id),
    mutationFn: async ({ id }) => {
      if (isGuest) {
        guestDeleteHabit(id)
        return
      }
      const { error } = await supabase.from('habits').delete().eq('id', id)
      if (error) throw error
    },
  })

  const restore = useOptimisticList<HabitRow, { row: HabitRow }>({
    keys: [qk.habits],
    errorMessage: 'Couldn’t bring that habit back.',
    apply: (rows, vars) => [...rows.filter((row) => row.id !== vars.row.id), vars.row],
    mutationFn: async ({ row }) => {
      if (isGuest) {
        guestInsertHabit(row)
        return
      }
      const { error } = await supabase.from('habits').insert(row)
      if (error) throw error
    },
  })

  return { add, update, markSpawned, remove, restore, newId }
}
