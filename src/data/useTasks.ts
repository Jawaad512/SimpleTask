import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuth, useUserId } from '../auth/AuthProvider'
import type { TaskRow, TaskTagRow } from '../lib/database.types'
import { isInstantFor, isQuickFor } from '../lib/duration'
import { supabase } from '../lib/supabase'
import {
  guestDeleteHabitInstances,
  guestDeleteTask,
  guestInsertTask,
  guestRestoreTask,
  guestTasks,
  guestUpdateTask,
} from './guestStore'
import { newId, qk } from './keys'
import { useOptimisticList } from './optimistic'

const DAY_MS = 86_400_000

/**
 * Active tasks, plus completed ones inside the rolling 24-hour window. The
 * window is filtered on read as well as purged on rollover, so a stale row
 * never reaches the screen.
 */
export function useTasks() {
  const { user, isGuest } = useAuth()

  return useQuery({
    queryKey: qk.tasks,
    enabled: Boolean(user),
    queryFn: async (): Promise<TaskRow[]> => {
      if (isGuest) return guestTasks()

      const since = new Date(Date.now() - DAY_MS).toISOString()
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .or(`status.eq.active,and(status.eq.done,completed_at.gt.${since})`)
        .order('position', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export interface NewTaskInput {
  title: string
  categoryId: string
  isInstant: boolean
  isToday: boolean
  isQuick: boolean
  estimatedMinutes?: number | null
  position: number
  habitId?: string | null
  isEphemeral?: boolean
}

export interface MoveInput {
  id: string
  isToday: boolean
  isQuick: boolean
  position: number
}

/** Null clears the estimate and hands the effort axis back to the drag. */
export interface EstimateInput {
  id: string
  minutes: number | null
  /** Supplied only when the new estimate moves the task to the other column. */
  position?: number
}

export function useTaskMutations() {
  const { isGuest } = useAuth()
  const userId = useUserId()
  const queryClient = useQueryClient()

  const buildRow = useCallback(
    (id: string, input: NewTaskInput): TaskRow => {
      const minutes = input.estimatedMinutes ?? null

      return {
        id,
        user_id: userId,
        title: input.title,
        category_id: input.categoryId,
        // An estimate owns the effort axis; without one the flag still implies
        // the left column. Both mirror the DB trigger.
        is_quick: minutes !== null ? isQuickFor(minutes) : input.isInstant ? true : input.isQuick,
        is_today: input.isToday,
        is_instant: minutes !== null ? isInstantFor(minutes) : input.isInstant,
        estimated_minutes: minutes,
        status: 'active',
        completed_at: null,
        carry_over_count: 0,
        habit_id: input.habitId ?? null,
        is_ephemeral: input.isEphemeral ?? false,
        position: input.position,
        created_at: new Date().toISOString(),
      }
    },
    [userId],
  )

  const add = useOptimisticList<TaskRow, NewTaskInput & { id: string }>({
    keys: [qk.tasks],
    errorMessage: 'Couldn’t save that task.',
    apply: (rows, vars) => [...rows, buildRow(vars.id, vars)],
    mutationFn: async (vars) => {
      const row = buildRow(vars.id, vars)
      if (isGuest) {
        guestInsertTask(row)
        return
      }
      const { error } = await supabase.from('tasks').insert({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        category_id: row.category_id,
        is_quick: row.is_quick,
        is_today: row.is_today,
        is_instant: row.is_instant,
        estimated_minutes: row.estimated_minutes,
        habit_id: row.habit_id,
        is_ephemeral: row.is_ephemeral,
        position: row.position,
      })
      if (error) throw error
    },
  })

  /** Drop handler: destination axes plus the fractional position. */
  const move = useOptimisticList<TaskRow, MoveInput>({
    keys: [qk.tasks],
    errorMessage: 'Couldn’t move that task.',
    apply: (rows, vars) =>
      rows.map((row) =>
        row.id === vars.id
          ? {
              ...row,
              is_today: vars.isToday,
              is_quick: vars.isQuick,
              // Dragging into the 20-min-plus column clears the flag.
              is_instant: vars.isQuick ? row.is_instant : false,
              position: vars.position,
            }
          : row,
      ),
    mutationFn: async ({ id, isToday, isQuick, position }) => {
      const patch = {
        is_today: isToday,
        is_quick: isQuick,
        ...(isQuick ? {} : { is_instant: false as const }),
        position,
      }
      if (isGuest) {
        guestUpdateTask(id, patch)
        return
      }
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) throw error
    },
  })

  /**
   * Setting an estimate also settles the effort axis, because the number and
   * the column are two views of the same fact. A position comes along only
   * when that lands the task in the other column, where its old position would
   * be meaningless.
   */
  const setCategory = useOptimisticList<TaskRow, { id: string; categoryId: string }>({
    keys: [qk.tasks],
    errorMessage: 'Couldn’t change that category.',
    apply: (rows, vars) =>
      rows.map((row) => (row.id === vars.id ? { ...row, category_id: vars.categoryId } : row)),
    mutationFn: async ({ id, categoryId }) => {
      const patch = { category_id: categoryId }
      if (isGuest) {
        guestUpdateTask(id, patch)
        return
      }
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) throw error
    },
  })

  /** A rename, and nothing else — the title is no one else's business. */
  const setTitle = useOptimisticList<TaskRow, { id: string; title: string }>({
    keys: [qk.tasks],
    errorMessage: 'Couldn’t rename that task.',
    apply: (rows, vars) =>
      rows.map((row) => (row.id === vars.id ? { ...row, title: vars.title } : row)),
    mutationFn: async ({ id, title }) => {
      const patch = { title }
      if (isGuest) {
        guestUpdateTask(id, patch)
        return
      }
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) throw error
    },
  })

  const setEstimate = useOptimisticList<TaskRow, EstimateInput>({
    keys: [qk.tasks],
    errorMessage: 'Couldn’t save that estimate.',
    apply: (rows, vars) =>
      rows.map((row) =>
        row.id === vars.id
          ? {
              ...row,
              estimated_minutes: vars.minutes,
              is_quick: vars.minutes === null ? row.is_quick : isQuickFor(vars.minutes),
              is_instant: vars.minutes === null ? row.is_instant : isInstantFor(vars.minutes),
              position: vars.position ?? row.position,
            }
          : row,
      ),
    mutationFn: async ({ id, minutes, position }) => {
      const patch = {
        estimated_minutes: minutes,
        ...(minutes === null
          ? {}
          : { is_quick: isQuickFor(minutes), is_instant: isInstantFor(minutes) }),
        ...(position === undefined ? {} : { position }),
      }
      if (isGuest) {
        guestUpdateTask(id, patch)
        return
      }
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) throw error
    },
  })

  /** Completion never touches is_quick or is_today, so restore needs no extra state. */
  const setStatus = useOptimisticList<TaskRow, { id: string; done: boolean }>({
    keys: [qk.tasks],
    errorMessage: 'Couldn’t update that task.',
    apply: (rows, vars) =>
      rows.map((row) =>
        row.id === vars.id
          ? {
              ...row,
              status: vars.done ? 'done' : 'active',
              completed_at: vars.done ? new Date().toISOString() : null,
            }
          : row,
      ),
    mutationFn: async ({ id, done }) => {
      const patch = done
        ? { status: 'done' as const, completed_at: new Date().toISOString() }
        : { status: 'active' as const, completed_at: null }
      if (isGuest) {
        guestUpdateTask(id, patch)
        return
      }
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) throw error
    },
  })

  const remove = useOptimisticList<TaskRow, { id: string }>({
    keys: [qk.tasks, qk.taskTags],
    errorMessage: 'Couldn’t delete that task.',
    apply: (rows, vars) => rows.filter((row) => row.id !== vars.id),
    mutationFn: async ({ id }) => {
      if (isGuest) {
        guestDeleteTask(id)
        return
      }
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
  })

  /** Undo for a delete: put the row back exactly as it was, tags included. */
  const restore = useOptimisticList<TaskRow, { row: TaskRow; tagIds: string[] }>({
    keys: [qk.tasks, qk.taskTags],
    errorMessage: 'Couldn’t bring that task back.',
    apply: (rows, vars) => [...rows.filter((row) => row.id !== vars.row.id), vars.row],
    mutationFn: async ({ row, tagIds }) => {
      if (isGuest) {
        guestRestoreTask(row, tagIds)
        return
      }
      const { error } = await supabase.from('tasks').insert(row)
      if (error) throw error

      if (tagIds.length > 0) {
        const { error: linkError } = await supabase
          .from('task_tags')
          .insert(tagIds.map((tagId) => ({ task_id: row.id, tag_id: tagId })))
        if (linkError) throw linkError
      }
    },
  })

  const removeHabitInstances = useOptimisticList<TaskRow, { habitId: string }>({
    keys: [qk.tasks],
    errorMessage: 'Couldn’t take that habit off the board.',
    apply: (rows, vars) =>
      rows.filter((row) => !(row.habit_id === vars.habitId && row.is_ephemeral && row.status === 'active')),
    mutationFn: async ({ habitId }) => {
      if (isGuest) {
        guestDeleteHabitInstances(habitId)
        return
      }
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('habit_id', habitId)
        .eq('is_ephemeral', true)
        .eq('status', 'active')
      if (error) throw error
    },
  })

  /** Snapshot used to rebuild a task after a delete is undone. */
  const snapshot = useCallback(
    (id: string): { row: TaskRow; tagIds: string[] } | null => {
      const rows = queryClient.getQueryData<TaskRow[]>(qk.tasks) ?? []
      const row = rows.find((candidate) => candidate.id === id)
      if (!row) return null

      const links = queryClient.getQueryData<TaskTagRow[]>(qk.taskTags) ?? []
      return { row, tagIds: links.filter((link) => link.task_id === id).map((link) => link.tag_id) }
    },
    [queryClient],
  )

  return {
    add,
    move,
    setCategory,
    setEstimate,
    setTitle,
    setStatus,
    remove,
    restore,
    removeHabitInstances,
    snapshot,
    newId,
  }
}
