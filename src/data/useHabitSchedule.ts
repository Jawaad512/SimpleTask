import { useEffect, useRef } from 'react'
import type { HabitRow, TaskRow } from '../lib/database.types'
import { localDateString } from '../lib/dates'
import { hasDay } from '../lib/weekdays'
import { useHabitMutations } from './useHabits'

interface ScheduleOptions {
  habits: HabitRow[]
  tasks: TaskRow[]
  /** Both queries have settled. Spawning against a half-loaded board duplicates. */
  ready: boolean
  onSpawn: (habit: HabitRow) => void
}

/**
 * Places a habit on the board on the days it is scheduled for, once each.
 *
 * `last_spawn_on` is the whole mechanism: it is stamped the first time a habit
 * places itself on a given local date and consulted before doing so again, so
 * taking the habit off the board by hand keeps it off for the rest of that day
 * rather than having it reappear on the next render.
 */
export function useHabitSchedule({ habits, tasks, ready, onSpawn }: ScheduleOptions) {
  const { markSpawned } = useHabitMutations()

  // Optimistic writes reach the cache before the network, but a burst of
  // renders inside one tick would still see the old rows. This closes that gap.
  const handled = useRef(new Set<string>())
  const onSpawnRef = useRef(onSpawn)
  onSpawnRef.current = onSpawn

  useEffect(() => {
    if (!ready) return

    const today = localDateString()
    const day = new Date().getDay()

    const onBoard = new Set(
      tasks
        .filter((task) => task.is_ephemeral && task.status === 'active' && task.habit_id)
        .map((task) => task.habit_id as string),
    )

    for (const habit of habits) {
      if (!hasDay(habit.days, day)) continue
      if (habit.last_spawn_on === today) continue

      const key = `${habit.id}:${today}`
      if (handled.current.has(key)) continue
      handled.current.add(key)

      // Already there — record the day anyway, so removing it sticks.
      if (!onBoard.has(habit.id)) onSpawnRef.current(habit)
      markSpawned.mutate({ id: habit.id, date: today })
    }
    // markSpawned is recreated every render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, tasks, ready])
}
