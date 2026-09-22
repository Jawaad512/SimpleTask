import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import type { TagRow, TaskTagRow } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import {
  guestCreateAndApplyTag,
  guestDeleteTag,
  guestRenameTag,
  guestTags,
  guestTaskTags,
  guestToggleTaskTag,
  guestUpsertTag,
} from './guestStore'
import { qk } from './keys'
import { useOptimisticList } from './optimistic'

export function useTags() {
  const { user, isGuest } = useAuth()

  return useQuery({
    queryKey: qk.tags,
    enabled: Boolean(user),
    queryFn: async (): Promise<TagRow[]> => {
      if (isGuest) return guestTags()
      const { data, error } = await supabase.from('tags').select('*').order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useTaskTags() {
  const { user, isGuest } = useAuth()

  return useQuery({
    queryKey: qk.taskTags,
    enabled: Boolean(user),
    queryFn: async (): Promise<TaskTagRow[]> => {
      if (isGuest) return guestTaskTags()
      const { data, error } = await supabase.from('task_tags').select('task_id, tag_id')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useTagMutations() {
  const { isGuest } = useAuth()
  const queryClient = useQueryClient()

  const toggle = useOptimisticList<TaskTagRow, { taskId: string; tagId: string; on: boolean }>({
    keys: [qk.taskTags],
    errorMessage: 'Couldn’t update the tags on that task.',
    apply: (rows, vars) =>
      vars.on
        ? [...rows.filter((row) => !(row.task_id === vars.taskId && row.tag_id === vars.tagId)),
           { task_id: vars.taskId, tag_id: vars.tagId }]
        : rows.filter((row) => !(row.task_id === vars.taskId && row.tag_id === vars.tagId)),
    mutationFn: async ({ taskId, tagId, on }) => {
      if (isGuest) {
        guestToggleTaskTag(taskId, tagId, on)
        return
      }
      if (on) {
        const { error } = await supabase.from('task_tags').insert({ task_id: taskId, tag_id: tagId })
        if (error) throw error
        return
      }
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', taskId)
        .eq('tag_id', tagId)
      if (error) throw error
    },
  })

  /** Creates a tag with nothing attached yet, for defining them up front. */
  const create = useOptimisticList<TagRow, { name: string }>({
    keys: [qk.tags],
    errorMessage: 'Couldn’t create that tag.',
    apply: (rows) => rows,
    mutationFn: async ({ name }) => {
      if (isGuest) {
        guestUpsertTag(name)
        return
      }
      const { error } = await supabase.rpc('upsert_tag', { p_name: name })
      if (error) throw error
    },
  })

  /** Creates the tag if it's new and applies it in one step. */
  const createAndApply = useOptimisticList<TagRow, { taskId: string; name: string }>({
    keys: [qk.tags, qk.taskTags],
    errorMessage: 'Couldn’t create that tag.',
    apply: (rows) => rows,
    mutationFn: async ({ taskId, name }) => {
      if (isGuest) {
        const tag = guestCreateAndApplyTag(taskId, name)
        rememberTag(queryClient, tag)
        rememberLink(queryClient, taskId, tag.id)
        return
      }

      const { data, error } = await supabase.rpc('upsert_tag', { p_name: name })
      if (error) throw error

      const tag = data as TagRow
      const { error: linkError } = await supabase
        .from('task_tags')
        .upsert({ task_id: taskId, tag_id: tag.id }, { onConflict: 'task_id,tag_id' })
      if (linkError) throw linkError

      rememberTag(queryClient, tag)
      rememberLink(queryClient, taskId, tag.id)
    },
  })

  /**
   * Names are unique per user, case-insensitively, so renaming onto an existing
   * name is a merge rather than an error — the links move across and the empty
   * tag goes. `rename_tag` does the whole thing in one transaction.
   */
  const rename = useOptimisticList<TagRow, { id: string; name: string }>({
    keys: [qk.tags, qk.taskTags],
    errorMessage: 'Couldn’t rename that tag.',
    apply: (rows, vars) => {
      const collision = rows.find(
        (row) => row.id !== vars.id && row.name.toLowerCase() === vars.name.toLowerCase(),
      )
      if (collision) {
        return rows
          .filter((row) => row.id !== vars.id)
          .map((row) => (row.id === collision.id ? { ...row, name: vars.name } : row))
      }
      return rows.map((row) => (row.id === vars.id ? { ...row, name: vars.name } : row))
    },
    mutationFn: async ({ id, name }) => {
      if (isGuest) {
        guestRenameTag(id, name)
        return
      }
      const { error } = await supabase.rpc('rename_tag', { p_tag: id, p_name: name })
      if (error) throw error
    },
  })

  const remove = useOptimisticList<TagRow, { id: string }>({
    keys: [qk.tags, qk.taskTags],
    errorMessage: 'Couldn’t delete the tag.',
    apply: (rows, vars) => rows.filter((row) => row.id !== vars.id),
    mutationFn: async ({ id }) => {
      if (isGuest) {
        guestDeleteTag(id)
        return
      }
      const { error } = await supabase.from('tags').delete().eq('id', id)
      if (error) throw error
    },
  })

  return { toggle, create, createAndApply, rename, remove }
}

function rememberTag(queryClient: ReturnType<typeof useQueryClient>, tag: TagRow) {
  queryClient.setQueryData<TagRow[]>(qk.tags, (rows) =>
    rows && !rows.some((row) => row.id === tag.id) ? [...rows, tag] : rows,
  )
}

function rememberLink(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string,
  tagId: string,
) {
  queryClient.setQueryData<TaskTagRow[]>(qk.taskTags, (rows) => {
    if (!rows) return rows
    if (rows.some((row) => row.task_id === taskId && row.tag_id === tagId)) return rows
    return [...rows, { task_id: taskId, tag_id: tagId }]
  })
}
