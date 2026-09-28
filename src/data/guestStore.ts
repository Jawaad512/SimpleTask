import type {
  CategoryRow,
  DeadlineRow,
  HabitRow,
  TagRow,
  TaskRow,
  TaskTagRow,
} from '../lib/database.types'
import { localDateString } from '../lib/dates'
import { isInstantFor, isQuickFor } from '../lib/duration'
import { newId } from './keys'

export const GUEST_USER_ID = '00000000-0000-4000-a000-000000000001'

const STORAGE_KEY = 'simpletask.guest.v1'
const DAY_MS = 86_400_000

export type GuestSnapshot = {
  categories: CategoryRow[]
  tasks: TaskRow[]
  tags: TagRow[]
  taskTags: TaskTagRow[]
  deadlines: DeadlineRow[]
  habits: HabitRow[]
  /** The Future pane's pad. A guest's copy of what the owner keeps on the row. */
  futureNotes: string
}

let memory: GuestSnapshot | null = null

function persist(snapshot: GuestSnapshot) {
  memory = snapshot
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Private mode or a full store should not take the demo down.
  }
}

/**
 * A demo board saved before estimates and habit days existed is still a valid
 * board — fill the new fields in rather than discarding someone's session.
 */
function normalise(parsed: GuestSnapshot): GuestSnapshot {
  return {
    ...parsed,
    futureNotes: typeof parsed.futureNotes === 'string' ? parsed.futureNotes : '',
    tasks: parsed.tasks.map((row) => ({
      ...row,
      estimated_minutes: row.estimated_minutes ?? null,
    })),
    habits: (parsed.habits ?? []).map((row) => ({
      ...row,
      estimated_minutes: row.estimated_minutes ?? null,
      days: row.days ?? 0,
      last_spawn_on: row.last_spawn_on ?? null,
    })),
  }
}

function load(): GuestSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as GuestSnapshot
      if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.tasks)) {
        return normalise(parsed)
      }
    }
  } catch {
    // Fall through to a fresh seed.
  }
  return seed()
}

export function guestSnapshot(): GuestSnapshot {
  if (!memory) memory = load()
  return memory
}

function update(patch: (current: GuestSnapshot) => GuestSnapshot): GuestSnapshot {
  const next = patch(guestSnapshot())
  persist(next)
  return next
}

function addDays(n: number): string {
  const at = new Date()
  at.setDate(at.getDate() + n)
  return localDateString(at)
}

function seed(): GuestSnapshot {
  const now = new Date().toISOString()
  const work = 'a1000000-0000-4000-8000-000000000001'
  const home = 'a1000000-0000-4000-8000-000000000002'
  const study = 'a1000000-0000-4000-8000-000000000003'
  const tagFocus = 'b1000000-0000-4000-8000-000000000001'
  const habitStretch = 'c1000000-0000-4000-8000-000000000001'
  const t1 = 'd1000000-0000-4000-8000-000000000001'
  const t2 = 'd1000000-0000-4000-8000-000000000002'
  const t3 = 'd1000000-0000-4000-8000-000000000003'
  const t4 = 'd1000000-0000-4000-8000-000000000004'
  const t5 = 'd1000000-0000-4000-8000-000000000005'
  const t6 = 'd1000000-0000-4000-8000-000000000006'
  const tDone = 'd1000000-0000-4000-8000-000000000007'

  const snapshot: GuestSnapshot = {
    futureNotes: '',
    categories: [
      { id: work, user_id: GUEST_USER_ID, name: 'Work', color_slot: 5, position: 0, created_at: now },
      { id: home, user_id: GUEST_USER_ID, name: 'Home', color_slot: 3, position: 1, created_at: now },
      { id: study, user_id: GUEST_USER_ID, name: 'Study', color_slot: 1, position: 2, created_at: now },
    ],
    habits: [
      {
        id: habitStretch,
        user_id: GUEST_USER_ID,
        title: 'Stretch',
        category_id: home,
        is_quick: true,
        estimated_minutes: 10,
        days: 0b0111110,
        last_spawn_on: null,
        position: 0,
        is_active: true,
        created_at: now,
      },
    ],
    tags: [{ id: tagFocus, user_id: GUEST_USER_ID, name: 'focus', created_at: now }],
    taskTags: [{ task_id: t2, tag_id: tagFocus }],
    deadlines: [
      {
        id: newId(),
        user_id: GUEST_USER_ID,
        title: 'Portfolio site live',
        due_date: addDays(5),
        created_at: now,
      },
    ],
    tasks: [
      task(t1, 'Reply to recruiter', work, { isToday: true, isQuick: true, isInstant: true, minutes: 3, position: 1 }),
      task(t2, 'Draft case-study notes', work, { isToday: true, isQuick: false, minutes: 45, position: 1 }),
      task(t3, 'Buy oat milk', home, { isToday: true, isQuick: true, minutes: 15, position: 2 }),
      task(t4, 'Review lecture notes', study, { isToday: false, isQuick: true, position: 1 }),
      task(t5, 'Plan weekend trip', home, { isToday: false, isQuick: false, minutes: 60, position: 1 }),
      task(t6, 'Outline next chapter', study, { isToday: false, isQuick: false, position: 2 }),
      {
        ...task(tDone, 'Ship SimpleTask demo', work, {
          isToday: true,
          isQuick: false,
          position: 9,
        }),
        status: 'done',
        completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ],
  }

  persist(snapshot)
  return snapshot
}

function task(
  id: string,
  title: string,
  categoryId: string,
  axes: {
    isToday: boolean
    isQuick: boolean
    isInstant?: boolean
    minutes?: number
    position: number
    habitId?: string
  },
): TaskRow {
  const minutes = axes.minutes ?? null
  const isInstant = minutes !== null ? isInstantFor(minutes) : axes.isInstant ?? false
  return {
    id,
    user_id: GUEST_USER_ID,
    title,
    category_id: categoryId,
    is_quick: minutes !== null ? isQuickFor(minutes) : isInstant ? true : axes.isQuick,
    is_today: axes.isToday,
    is_instant: isInstant,
    estimated_minutes: minutes,
    status: 'active',
    completed_at: null,
    carry_over_count: 0,
    habit_id: axes.habitId ?? null,
    is_ephemeral: Boolean(axes.habitId),
    position: axes.position,
    created_at: new Date().toISOString(),
  }
}

export function guestCategories(): CategoryRow[] {
  return [...guestSnapshot().categories].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
}

export function guestTasks(): TaskRow[] {
  const since = Date.now() - DAY_MS
  return guestSnapshot()
    .tasks.filter(
      (row) =>
        row.status === 'active' ||
        (row.status === 'done' && row.completed_at && new Date(row.completed_at).getTime() > since),
    )
    .sort((a, b) => a.position - b.position)
}

export function guestTags(): TagRow[] {
  return [...guestSnapshot().tags].sort((a, b) => a.name.localeCompare(b.name))
}

export function guestTaskTags(): TaskTagRow[] {
  return [...guestSnapshot().taskTags]
}

export function guestDeadlines(): DeadlineRow[] {
  return [...guestSnapshot().deadlines].sort((a, b) => a.due_date.localeCompare(b.due_date))
}

export function guestHabits(): HabitRow[] {
  return guestSnapshot()
    .habits.filter((row) => row.is_active)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
}

export function guestInsertTask(row: TaskRow) {
  update((s) => ({ ...s, tasks: [...s.tasks, row] }))
}

export function guestUpdateTask(id: string, patch: Partial<TaskRow>) {
  update((s) => ({
    ...s,
    tasks: s.tasks.map((row) => (row.id === id ? { ...row, ...patch } : row)),
  }))
}

export function guestDeleteTask(id: string) {
  update((s) => ({
    ...s,
    tasks: s.tasks.filter((row) => row.id !== id),
    taskTags: s.taskTags.filter((link) => link.task_id !== id),
  }))
}

export function guestRestoreTask(row: TaskRow, tagIds: string[]) {
  update((s) => ({
    ...s,
    tasks: [...s.tasks.filter((task) => task.id !== row.id), row],
    taskTags: [
      ...s.taskTags.filter((link) => link.task_id !== row.id),
      ...tagIds.map((tagId) => ({ task_id: row.id, tag_id: tagId })),
    ],
  }))
}

export function guestDeleteHabitInstances(habitId: string) {
  update((s) => ({
    ...s,
    tasks: s.tasks.filter(
      (row) => !(row.habit_id === habitId && row.is_ephemeral && row.status === 'active'),
    ),
  }))
}

export function guestInsertCategory(row: CategoryRow) {
  update((s) => ({ ...s, categories: [...s.categories, row] }))
}

export function guestRenameCategory(id: string, name: string) {
  update((s) => ({
    ...s,
    categories: s.categories.map((row) => (row.id === id ? { ...row, name } : row)),
  }))
}

export function guestSetCategorySlot(id: string, colorSlot: number) {
  update((s) => {
    const moving = s.categories.find((row) => row.id === id)
    if (!moving) throw new Error('category not found')
    const incumbent = s.categories.find((row) => row.color_slot === colorSlot && row.id !== id)
    return {
      ...s,
      categories: s.categories.map((row) => {
        if (row.id === id) return { ...row, color_slot: colorSlot }
        if (incumbent && row.id === incumbent.id) return { ...row, color_slot: moving.color_slot }
        return row
      }),
    }
  })
}

export function guestReorderCategories(ids: string[]) {
  update((s) => ({
    ...s,
    categories: s.categories.map((row) => {
      const index = ids.indexOf(row.id)
      return index === -1 ? row : { ...row, position: index }
    }),
  }))
}

export function guestDeleteCategory(id: string, moveTo: string | null) {
  update((s) => {
    if (id === moveTo) throw new Error('cannot move a category into itself')
    let tasks = s.tasks
    let habits = s.habits
    if (moveTo) {
      if (!s.categories.some((row) => row.id === moveTo)) throw new Error('destination category not found')
      tasks = tasks.map((row) => (row.category_id === id ? { ...row, category_id: moveTo } : row))
      habits = habits.map((row) => (row.category_id === id ? { ...row, category_id: moveTo } : row))
    }
    const leftoverTasks = tasks.filter((row) => row.category_id === id).length
    const leftoverHabits = habits.filter((row) => row.category_id === id).length
    if (leftoverTasks > 0 || leftoverHabits > 0) {
      throw new Error(`category still has ${leftoverTasks} task(s) and ${leftoverHabits} habit(s)`)
    }
    return {
      ...s,
      tasks,
      habits,
      categories: s.categories.filter((row) => row.id !== id),
    }
  })
}

export function guestInsertHabit(row: HabitRow) {
  update((s) => ({ ...s, habits: [...s.habits, row] }))
}

export function guestUpdateHabit(id: string, patch: Partial<HabitRow>) {
  update((s) => ({
    ...s,
    habits: s.habits.map((row) => (row.id === id ? { ...row, ...patch } : row)),
  }))
}

export function guestDeleteHabit(id: string) {
  update((s) => ({
    ...s,
    habits: s.habits.filter((row) => row.id !== id),
    tasks: s.tasks.map((row) => (row.habit_id === id ? { ...row, habit_id: null } : row)),
  }))
}

export function guestInsertDeadline(row: DeadlineRow) {
  update((s) => ({ ...s, deadlines: [...s.deadlines, row] }))
}

export function guestUpdateDeadline(id: string, patch: Partial<DeadlineRow>) {
  update((s) => ({
    ...s,
    deadlines: s.deadlines.map((row) => (row.id === id ? { ...row, ...patch } : row)),
  }))
}

export function guestDeleteDeadline(id: string) {
  update((s) => ({ ...s, deadlines: s.deadlines.filter((row) => row.id !== id) }))
}

export function guestFutureNotes(): string {
  return guestSnapshot().futureNotes
}

export function guestSetFutureNotes(text: string) {
  update((s) => ({ ...s, futureNotes: text }))
}

export function guestToggleTaskTag(taskId: string, tagId: string, on: boolean) {
  update((s) => ({
    ...s,
    taskTags: on
      ? [
          ...s.taskTags.filter((link) => !(link.task_id === taskId && link.tag_id === tagId)),
          { task_id: taskId, tag_id: tagId },
        ]
      : s.taskTags.filter((link) => !(link.task_id === taskId && link.tag_id === tagId)),
  }))
}

export function guestUpsertTag(name: string): TagRow {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('tag name is empty')
  const current = guestSnapshot()
  const existing = current.tags.find((row) => row.name.toLowerCase() === trimmed.toLowerCase())
  if (existing) return existing
  const row: TagRow = {
    id: newId(),
    user_id: GUEST_USER_ID,
    name: trimmed,
    created_at: new Date().toISOString(),
  }
  persist({ ...current, tags: [...current.tags, row] })
  return row
}

export function guestCreateAndApplyTag(taskId: string, name: string) {
  const tag = guestUpsertTag(name)
  guestToggleTaskTag(taskId, tag.id, true)
  return tag
}

/** Renaming onto a name already in use merges the two, as the RPC does. */
export function guestRenameTag(id: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('tag name is empty')

  update((s) => {
    const other = s.tags.find(
      (row) => row.id !== id && row.name.toLowerCase() === trimmed.toLowerCase(),
    )

    if (!other) {
      return { ...s, tags: s.tags.map((row) => (row.id === id ? { ...row, name: trimmed } : row)) }
    }

    const held = new Set(
      s.taskTags.filter((link) => link.tag_id === other.id).map((link) => link.task_id),
    )

    return {
      ...s,
      tags: s.tags
        .filter((row) => row.id !== id)
        .map((row) => (row.id === other.id ? { ...row, name: trimmed } : row)),
      taskTags: [
        ...s.taskTags.filter((link) => link.tag_id !== id),
        ...s.taskTags
          .filter((link) => link.tag_id === id && !held.has(link.task_id))
          .map((link) => ({ task_id: link.task_id, tag_id: other.id })),
      ],
    }
  })
}

export function guestDeleteTag(id: string) {
  update((s) => ({
    ...s,
    tags: s.tags.filter((row) => row.id !== id),
    taskTags: s.taskTags.filter((link) => link.tag_id !== id),
  }))
}
