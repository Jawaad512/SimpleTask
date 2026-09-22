import { useQuery } from '@tanstack/react-query'
import { useAuth, useUserId } from '../auth/AuthProvider'
import type { CategoryRow } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import {
  guestDeleteCategory,
  guestInsertCategory,
  guestCategories,
  guestRenameCategory,
  guestReorderCategories,
  guestSetCategorySlot,
} from './guestStore'
import { newId, qk } from './keys'
import { useOptimisticList } from './optimistic'

export function useCategories() {
  const { user, isGuest } = useAuth()

  return useQuery({
    queryKey: qk.categories,
    enabled: Boolean(user),
    queryFn: async (): Promise<CategoryRow[]> => {
      if (isGuest) return guestCategories()

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCategoryMutations() {
  const { isGuest } = useAuth()
  const userId = useUserId()

  const create = useOptimisticList<
    CategoryRow,
    { id: string; name: string; colorSlot: number; position: number }
  >({
    keys: [qk.categories],
    errorMessage: 'Couldn’t save the new category.',
    apply: (rows, vars) => [
      ...rows,
      {
        id: vars.id,
        user_id: userId,
        name: vars.name,
        color_slot: vars.colorSlot,
        position: vars.position,
        created_at: new Date().toISOString(),
      },
    ],
    mutationFn: async ({ id, name, colorSlot, position }) => {
      if (isGuest) {
        guestInsertCategory({
          id,
          user_id: userId,
          name,
          color_slot: colorSlot,
          position,
          created_at: new Date().toISOString(),
        })
        return
      }
      const { error } = await supabase
        .from('categories')
        .insert({ id, user_id: userId, name, color_slot: colorSlot, position })
      if (error) throw error
    },
  })

  const rename = useOptimisticList<CategoryRow, { id: string; name: string }>({
    keys: [qk.categories],
    errorMessage: 'Couldn’t rename the category.',
    apply: (rows, vars) => rows.map((row) => (row.id === vars.id ? { ...row, name: vars.name } : row)),
    mutationFn: async ({ id, name }) => {
      if (isGuest) {
        guestRenameCategory(id, name)
        return
      }
      const { error } = await supabase.from('categories').update({ name }).eq('id', id)
      if (error) throw error
    },
  })

  /** Picking an occupied slot swaps the two categories rather than failing. */
  const recolour = useOptimisticList<CategoryRow, { id: string; colorSlot: number }>({
    keys: [qk.categories],
    errorMessage: 'Couldn’t change the colour.',
    apply: (rows, vars) => {
      const moving = rows.find((row) => row.id === vars.id)
      if (!moving) return rows
      const incumbent = rows.find((row) => row.color_slot === vars.colorSlot && row.id !== vars.id)

      return rows.map((row) => {
        if (row.id === vars.id) return { ...row, color_slot: vars.colorSlot }
        if (incumbent && row.id === incumbent.id) return { ...row, color_slot: moving.color_slot }
        return row
      })
    },
    mutationFn: async ({ id, colorSlot }) => {
      if (isGuest) {
        guestSetCategorySlot(id, colorSlot)
        return
      }
      const { error } = await supabase.rpc('set_category_slot', { p_category: id, p_slot: colorSlot })
      if (error) throw error
    },
  })

  const reorder = useOptimisticList<CategoryRow, { ids: string[] }>({
    keys: [qk.categories],
    errorMessage: 'Couldn’t save the new order.',
    apply: (rows, vars) =>
      rows.map((row) => {
        const index = vars.ids.indexOf(row.id)
        return index === -1 ? row : { ...row, position: index }
      }),
    mutationFn: async ({ ids }) => {
      if (isGuest) {
        guestReorderCategories(ids)
        return
      }
      const { error } = await supabase.rpc('reorder_categories', { p_ids: ids })
      if (error) throw error
    },
  })

  const remove = useOptimisticList<CategoryRow, { id: string; moveTo: string | null }>({
    keys: [qk.categories, qk.tasks, qk.habits],
    errorMessage: 'Couldn’t delete the category.',
    apply: (rows, vars) => rows.filter((row) => row.id !== vars.id),
    mutationFn: async ({ id, moveTo }) => {
      if (isGuest) {
        guestDeleteCategory(id, moveTo)
        return
      }
      const { error } = await supabase.rpc('delete_category', { p_category: id, p_move_to: moveTo })
      if (error) throw error
    },
  })

  return { create, rename, recolour, reorder, remove, newId }
}
