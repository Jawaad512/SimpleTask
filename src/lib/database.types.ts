/**
 * Hand-maintained mirror of supabase/migrations. Regenerate with
 * `npx supabase gen types typescript --linked` if the schema moves.
 *
 * These are type aliases rather than interfaces on purpose: postgrest-js
 * constrains a schema to `Record<string, unknown>`, and only type aliases pick
 * up an implicit index signature.
 */

export type TaskStatus = 'active' | 'done'

export type CategoryRow = {
  id: string
  user_id: string
  name: string
  color_slot: number
  position: number
  created_at: string
}

export type HabitRow = {
  id: string
  user_id: string
  title: string
  category_id: string
  is_quick: boolean
  estimated_minutes: number | null
  /** Seven-bit mask, bit 0 = Sunday. 0 means the habit never places itself. */
  days: number
  /** Last local date this habit placed itself, so it does so once per day. */
  last_spawn_on: string | null
  position: number
  is_active: boolean
  created_at: string
}

export type TaskRow = {
  id: string
  user_id: string
  title: string
  category_id: string
  is_quick: boolean
  is_today: boolean
  is_instant: boolean
  /** Null means never estimated: no figure on the card, free to drag. */
  estimated_minutes: number | null
  status: TaskStatus
  completed_at: string | null
  carry_over_count: number
  habit_id: string | null
  is_ephemeral: boolean
  position: number
  created_at: string
}

export type TagRow = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type TaskTagRow = {
  task_id: string
  tag_id: string
}

export type DeadlineRow = {
  id: string
  user_id: string
  title: string
  due_date: string
  created_at: string
}

export type UserSettingsRow = {
  user_id: string
  last_rollover_on: string | null
}

export type GuestInterestRow = {
  id: string
  email: string
  created_at: string
}

export type GuestFeedbackRow = {
  id: string
  message: string
  email: string | null
  created_at: string
}

export type RolloverResult = {
  did_run: boolean
  carried_over: number
  habits_cleared: number
  completed_purged: number
}

type WithDefaults<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>

type TableOf<TRow, TInsert> = {
  Row: TRow
  Insert: TInsert
  Update: Partial<TRow>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      categories: TableOf<
        CategoryRow,
        WithDefaults<CategoryRow, 'id' | 'created_at' | 'position'>
      >
      habits: TableOf<
        HabitRow,
        WithDefaults<
          HabitRow,
          | 'id'
          | 'created_at'
          | 'position'
          | 'is_active'
          | 'estimated_minutes'
          | 'days'
          | 'last_spawn_on'
        >
      >
      tasks: TableOf<
        TaskRow,
        WithDefaults<
          TaskRow,
          | 'id'
          | 'created_at'
          | 'is_instant'
          | 'is_quick'
          | 'is_today'
          | 'estimated_minutes'
          | 'status'
          | 'completed_at'
          | 'carry_over_count'
          | 'habit_id'
          | 'is_ephemeral'
          | 'position'
        >
      >
      tags: TableOf<TagRow, WithDefaults<TagRow, 'id' | 'created_at'>>
      task_tags: TableOf<TaskTagRow, TaskTagRow>
      deadlines: TableOf<DeadlineRow, WithDefaults<DeadlineRow, 'id' | 'created_at'>>
      user_settings: TableOf<UserSettingsRow, UserSettingsRow>
      guest_interest: TableOf<GuestInterestRow, WithDefaults<GuestInterestRow, 'id' | 'created_at'>>
      guest_feedback: TableOf<
        GuestFeedbackRow,
        WithDefaults<GuestFeedbackRow, 'id' | 'created_at' | 'email'>
      >
    }
    Views: Record<string, never>
    Functions: {
      run_daily_rollover: {
        Args: { p_local_date: string }
        Returns: RolloverResult[]
      }
      set_category_slot: {
        Args: { p_category: string; p_slot: number }
        Returns: undefined
      }
      reorder_categories: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      delete_category: {
        Args: { p_category: string; p_move_to: string | null }
        Returns: undefined
      }
      upsert_tag: {
        Args: { p_name: string }
        Returns: TagRow
      }
      rename_tag: {
        Args: { p_tag: string; p_name: string }
        Returns: TagRow
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
