import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth/AuthProvider'
import { SignIn } from './auth/SignIn'
import { newId } from './data/keys'
import { useInterestCount } from './data/useLeads'
import { useCategories } from './data/useCategories'
import { useHabits } from './data/useHabits'
import { useHabitSchedule } from './data/useHabitSchedule'
import { useRollover } from './data/useRollover'
import { useTags, useTaskTags } from './data/useTags'
import { useTaskMutations, useTasks } from './data/useTasks'
import type { HabitRow, TaskRow } from './lib/database.types'
import { formatTotal, isInstantFor, isQuickFor, totalMinutes } from './lib/duration'
import { appendPosition } from './lib/position'
import { quadrantId } from './lib/quadrant'
import { Board } from './features/board/Board'
import { QuickAdd } from './features/board/QuickAdd'
import { CategoryManager } from './features/categories/CategoryManager'
import { DeadlinesPane } from './features/deadlines/DeadlinesPane'
import { DoneIntro, DoneView } from './features/done/DoneView'
import { FuturePane } from './features/future/FuturePane'
import { HabitsPane } from './features/habits/HabitsPane'
import { InfoPage } from './features/info/InfoPage'
import { LeadsPanel } from './features/leads/LeadsPanel'
import { ListView } from './features/list/ListView'
import { TaskSheet } from './features/sheet/TaskSheet'
import { SignOutIcon } from './ui/Icons'
import { useLayout } from './ui/Layout'
import { dismissSplash } from './ui/splash'
import { useToast } from './ui/Toast'
import { Wordmark } from './ui/Wordmark'

/**
 * Quick-add lands a task in Today. Which column it lands in is the estimate's
 * to decide; without one it keeps the old default of under 20 minutes.
 */
function quickAddAxes(minutes: number | null) {
  return { isToday: true, isQuick: minutes === null ? true : isQuickFor(minutes) }
}

type Section = 'grid' | 'list' | 'done' | 'deadlines' | 'habits' | 'future' | 'info'

const MAIN_TABS: Array<{ id: Section; label: string }> = [
  { id: 'grid', label: 'Grid' },
  { id: 'list', label: 'List' },
  { id: 'done', label: 'Done' },
]

const RAIL_TABS: Array<{ id: Section; label: string }> = [
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'habits', label: 'Habits' },
  { id: 'future', label: 'Future' },
]

export default function App() {
  const { session, loading, isGuest } = useAuth()

  // The splash in index.html covers everything up to this point, so there is
  // no second spinner to render here — only the moment to take it away.
  useEffect(() => {
    if (!loading) dismissSplash()
  }, [loading])

  if (loading) return null

  return session || isGuest ? <AppShell /> : <SignIn />
}

function AppShell() {
  const { isPhone } = useLayout()
  const { signOut, isGuest, exitGuest } = useAuth()
  const toast = useToast()
  const rolloverSettled = useRollover()

  const { data: categories = [], isPending: loadingCategories } = useCategories()
  const { data: tasks = [], isSuccess: tasksLoaded, isFetching: tasksFetching } = useTasks()
  const { data: habits = [], isSuccess: habitsLoaded } = useHabits()
  const { data: tags = [] } = useTags()
  const { data: links = [] } = useTaskTags()
  const {
    add,
    move,
    setCategory,
    setEstimate,
    setStatus,
    remove,
    restore,
    removeHabitInstances,
    snapshot,
  } = useTaskMutations()

  const [chosenSection, setChosenSection] = useState<Section>('grid')
  const [managingCategories, setManagingCategories] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [leadsOpen, setLeadsOpen] = useState(false)

  // The rail is always visible on desktop, so its two sections are never the
  // main column's current view.
  const railSection =
    chosenSection === 'deadlines' || chosenSection === 'habits' || chosenSection === 'future'
  const section: Section = !isPhone && railSection ? 'grid' : chosenSection

  const activeTasks = useMemo(() => tasks.filter((task) => task.status === 'active'), [tasks])
  const instantCount = useMemo(
    () => activeTasks.filter((task) => task.is_instant).length,
    [activeTasks],
  )
  /** Both Today quadrants together — the answer to "how long is today?". */
  const todayMinutes = useMemo(
    () => totalMinutes(activeTasks.filter((task) => task.is_today)),
    [activeTasks],
  )

  const openTask = openTaskId ? tasks.find((task) => task.id === openTaskId) ?? null : null

  function positionAtEndOf(axes: { isToday: boolean; isQuick: boolean }, excludeId?: string): number {
    const target = quadrantId({ is_today: axes.isToday, is_quick: axes.isQuick })
    return appendPosition(
      activeTasks
        .filter((task) => task.id !== excludeId && quadrantId(task) === target)
        .map((task) => task.position),
    )
  }

  function handleComplete(task: TaskRow) {
    setStatus.mutate({ id: task.id, done: true })
    toast.showUndo(`Completed “${task.title}”`, () =>
      setStatus.mutate({ id: task.id, done: false }),
    )
  }

  function handleDelete(task: TaskRow) {
    const captured = snapshot(task.id)
    remove.mutate({ id: task.id })
    toast.showUndo(`Deleted “${task.title}”`, () => {
      if (captured) restore.mutate(captured)
    })
  }

  /**
   * Changing the estimate can change the column, and a position from the old
   * column means nothing in the new one — so it is recomputed here, where the
   * board's contents are already in hand.
   */
  function handleSetEstimate(task: TaskRow, minutes: number | null) {
    if (minutes === task.estimated_minutes) return

    const nextQuick = minutes === null ? task.is_quick : isQuickFor(minutes)
    const nextInstant = minutes === null ? task.is_instant : isInstantFor(minutes)
    const moves = nextQuick !== task.is_quick || nextInstant !== task.is_instant

    setEstimate.mutate({
      id: task.id,
      minutes,
      position: moves
        ? positionAtEndOf({ isToday: task.is_today, isQuick: nextQuick }, task.id)
        : undefined,
    })
  }

  function handleSetAxes(task: TaskRow, axes: { isToday: boolean; isQuick: boolean }) {
    if (axes.isToday === task.is_today && axes.isQuick === task.is_quick) return
    move.mutate({
      id: task.id,
      isToday: axes.isToday,
      isQuick: axes.isQuick,
      position: positionAtEndOf(axes, task.id),
    })
  }

  function handleSetCategory(task: TaskRow, categoryId: string) {
    if (categoryId === task.category_id) return
    setCategory.mutate({ id: task.id, categoryId })
  }

  function handleSpawnHabit(habit: HabitRow) {
    const minutes = habit.estimated_minutes
    const axes = { isToday: true, isQuick: minutes === null ? habit.is_quick : isQuickFor(minutes) }
    add.mutate({
      id: newId(),
      title: habit.title,
      categoryId: habit.category_id,
      isInstant: minutes === null ? false : isInstantFor(minutes),
      isToday: axes.isToday,
      isQuick: axes.isQuick,
      estimatedMinutes: minutes,
      position: positionAtEndOf(axes),
      habitId: habit.id,
      isEphemeral: true,
    })
  }

  // Habits scheduled for today place themselves, once each.
  // Not before the rollover has had its say, and not while the task list is
  // in flight — either would place a habit against a board that is about to
  // change underneath it.
  useHabitSchedule({
    habits,
    tasks,
    ready: tasksLoaded && habitsLoaded && rolloverSettled && !tasksFetching,
    onSpawn: handleSpawnHabit,
  })

  const boardChrome = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {activeTasks.length} active{instantCount > 0 ? ` · ${instantCount} under 5 min` : ''}
          {todayMinutes > 0 ? ` · ${formatTotal(todayMinutes)} today` : ''}
        </span>
      </div>

      <QuickAdd
        categories={categories}
        loading={loadingCategories}
        onAdd={({ title, categoryId, estimatedMinutes }) => {
          const axes = quickAddAxes(estimatedMinutes)
          add.mutate({
            id: newId(),
            title,
            categoryId,
            isInstant: estimatedMinutes === null ? false : isInstantFor(estimatedMinutes),
            estimatedMinutes,
            ...axes,
            position: positionAtEndOf(axes),
          })
        }}
      />
    </>
  )

  const boardGrid = (
    <div style={{ position: 'relative' }}>
      <Board
        tasks={activeTasks}
        categories={categories}
        onComplete={handleComplete}
        onOpen={(task) => setOpenTaskId(task.id)}
        onMove={(input) => move.mutate(input)}
      />

      {/* Only once the query has settled. Keyed off length alone this told
          you to create a category every time the page loaded. */}
      {!loadingCategories && categories.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-modal)',
              padding: 18,
              boxShadow: 'var(--shadow-hover)',
              textAlign: 'center',
            }}
          >
            <p className="t-row-title" style={{ margin: 0 }}>
              Create a category to start adding tasks.
            </p>
            <button
              type="button"
              className="t-control"
              onClick={() => setManagingCategories(true)}
              style={{
                borderRadius: 'var(--r-pill)',
                padding: '7px 14px',
                background: 'var(--ink)',
                color: 'var(--canvas)',
              }}
            >
              Categories
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const board = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {boardChrome}
      {boardGrid}
    </div>
  )

  const main =
    section === 'list' ? (
      <ListView
        tasks={activeTasks}
        categories={categories}
        tags={tags}
        links={links}
        onComplete={handleComplete}
        onOpen={(task) => setOpenTaskId(task.id)}
        onManageCategories={() => setManagingCategories(true)}
      />
    ) : section === 'done' ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DoneIntro />
        <DoneView
          tasks={tasks}
          categories={categories}
          onRestore={(task) => setStatus.mutate({ id: task.id, done: false })}
        />
      </div>
    ) : section === 'deadlines' ? (
      <DeadlinesPane />
    ) : section === 'habits' ? (
      <HabitsPane
        categories={categories}
        tasks={tasks}
        onSpawn={handleSpawnHabit}
        onClear={(habitId) => removeHabitInstances.mutate({ habitId })}
      />
    ) : section === 'future' ? (
      <FuturePane />
    ) : section === 'info' ? (
      <InfoPage />
    ) : (
      board
    )

  const tabs = [
    ...(isPhone ? [...MAIN_TABS, ...RAIL_TABS] : MAIN_TABS),
    ...(isGuest ? [{ id: 'info' as const, label: 'Info' }] : []),
  ]
  const showRail = !isPhone && section !== 'info'
  // Chrome (add-task, filters, the done note) sits above; the rail meets the first card.
  const railBesideGrid = showRail && section === 'grid'
  const railBesideList = showRail && section === 'list'
  const railBesideDone = showRail && section === 'done'
  const railBesideMain = railBesideGrid || railBesideList || railBesideDone

  const rail = showRail ? (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <DeadlinesPane />
      <HabitsPane
        categories={categories}
        tasks={tasks}
        onSpawn={handleSpawnHabit}
        onClear={(habitId) => removeHabitInstances.mutate({ habitId })}
      />
      <FuturePane />
    </aside>
  ) : null

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Two rows rather than one: at phone widths five tabs plus the wordmark
          cannot share a line without wrapping into a column. */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '12px 16px',
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Wordmark />
            {isGuest && (
              <span className="t-meta" style={{ color: 'var(--muted)' }}>
                Guest demo
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="t-control-sm nav-tab"
              onClick={() => setManagingCategories(true)}
            >
              Categories
            </button>
            {!isGuest && <InterestCountButton onOpen={() => setLeadsOpen(true)} />}
            <button
              type="button"
              className="icon-control"
              aria-label={isGuest ? 'Leave demo' : 'Sign out'}
              title={isGuest ? 'Leave demo' : 'Sign out'}
              onClick={() => {
                if (isGuest) exitGuest()
                else void signOut()
              }}
            >
              <SignOutIcon />
            </button>
          </div>
        </div>

        <nav aria-label="Sections" style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={tab.id === section ? 'page' : undefined}
              onClick={() => setChosenSection(tab.id)}
              className="t-control nav-tab"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: showRail ? 'minmax(0, 1fr) 292px' : 'minmax(0, 1fr)',
          gridTemplateRows: railBesideMain ? 'auto auto' : undefined,
          columnGap: 16,
          rowGap: railBesideMain ? 10 : 16,
          padding: '16px',
          alignItems: 'start',
        }}
      >
        {railBesideGrid ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              {boardChrome}
            </div>
            <div style={{ minWidth: 0, gridColumn: 1 }}>{boardGrid}</div>
            <div
              style={{
                gridColumn: 2,
                gridRow: 2,
                minWidth: 0,
                paddingTop: 'calc(var(--board-axis-row) + var(--board-axis-gap))',
              }}
            >
              {rail}
            </div>
          </>
        ) : railBesideList ? (
          <>
            <ListView
              besideRail
              tasks={activeTasks}
              categories={categories}
              tags={tags}
              links={links}
              onComplete={handleComplete}
              onOpen={(task) => setOpenTaskId(task.id)}
              onManageCategories={() => setManagingCategories(true)}
            />
            <div style={{ gridColumn: 2, gridRow: 2, minWidth: 0 }}>{rail}</div>
          </>
        ) : railBesideDone ? (
          <>
            <div style={{ minWidth: 0 }}>
              <DoneIntro />
            </div>
            <div style={{ minWidth: 0, gridColumn: 1 }}>
              <DoneView
                tasks={tasks}
                categories={categories}
                onRestore={(task) => setStatus.mutate({ id: task.id, done: false })}
              />
            </div>
            <div style={{ gridColumn: 2, gridRow: 2, minWidth: 0 }}>{rail}</div>
          </>
        ) : (
          <>
            <div style={{ minWidth: 0 }}>{main}</div>
            {rail}
          </>
        )}
      </main>

      {managingCategories && <CategoryManager onClose={() => setManagingCategories(false)} />}

      {leadsOpen && <LeadsPanel onClose={() => setLeadsOpen(false)} />}

      {openTask && (
        <TaskSheet
          task={openTask}
          category={categories.find((row) => row.id === openTask.category_id)}
          categories={categories}
          onClose={() => setOpenTaskId(null)}
          onSetEstimate={handleSetEstimate}
          onSetAxes={handleSetAxes}
          onSetCategory={handleSetCategory}
          onComplete={handleComplete}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

function InterestCountButton({ onOpen }: { onOpen: () => void }) {
  const { data: count, isSuccess } = useInterestCount()
  if (!isSuccess) return null

  return (
    <button
      type="button"
      className="t-meta pill"
      onClick={onOpen}
      title="Open interest and feedback"
      style={{ padding: '4px 9px', fontVariantNumeric: 'tabular-nums' }}
    >
      {count} interested
    </button>
  )
}
