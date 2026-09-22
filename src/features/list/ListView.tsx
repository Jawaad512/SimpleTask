import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCategoryMutations } from '../../data/useCategories'
import { useHabits } from '../../data/useHabits'
import { useTagMutations } from '../../data/useTags'
import { useTasks } from '../../data/useTasks'
import type { CategoryRow, TagRow, TaskRow, TaskTagRow } from '../../lib/database.types'
import { taskEstimate } from '../../lib/duration'
import { byPosition } from '../../lib/position'
import { slotColor } from '../../lib/palette'
import { CloseIcon, PencilIcon } from '../../ui/Icons'
import { completionDelay } from '../../ui/motion'
import { TickButton } from '../board/TickButton'
import { DeleteCategory } from '../categories/CategoryManager'
import { DeleteTag } from '../tags/DeleteTag'
import { TagManager } from '../tags/TagManager'

interface ListViewProps {
  tasks: TaskRow[]
  categories: CategoryRow[]
  tags: TagRow[]
  links: TaskTagRow[]
  onComplete: (task: TaskRow) => void
  onOpen: (task: TaskRow) => void
  onManageCategories: () => void
  /** Filters sit in the chrome row so the first task meets the rail. */
  besideRail?: boolean
}

export function ListView({
  tasks,
  categories,
  tags,
  links,
  onComplete,
  onOpen,
  onManageCategories,
  besideRail = false,
}: ListViewProps) {
  const { remove: removeTag } = useTagMutations()
  const { remove: removeCategory } = useCategoryMutations()
  const { data: allTasks = [] } = useTasks()
  const { data: habits = [] } = useHabits()
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [managingTags, setManagingTags] = useState(false)
  const [deletingTag, setDeletingTag] = useState<TagRow | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<CategoryRow | null>(null)

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const tagsByTask = useMemo(() => {
    const map = new Map<string, TagRow[]>()
    const tagById = new Map(tags.map((tag) => [tag.id, tag]))
    for (const link of links) {
      const tag = tagById.get(link.tag_id)
      if (!tag) continue
      const bucket = map.get(link.task_id)
      if (bucket) bucket.push(tag)
      else map.set(link.task_id, [tag])
    }
    return map
  }, [links, tags])

  // Several tags selected is OR; several categories is OR; the two combine as AND.
  const visible = useMemo(() => {
    return tasks
      .filter((task) => {
        if (selectedCategories.size > 0 && !selectedCategories.has(task.category_id)) return false
        if (selectedTags.size === 0) return true
        return (tagsByTask.get(task.id) ?? []).some((tag) => selectedTags.has(tag.id))
      })
      .sort(byPosition)
  }, [tasks, selectedCategories, selectedTags, tagsByTask])

  const dialogs = (
    <>
      {managingTags && <TagManager onClose={() => setManagingTags(false)} />}

      {deletingTag && (
        <DeleteTag
          tag={deletingTag}
          usageCount={links.filter((link) => link.tag_id === deletingTag.id).length}
          onCancel={() => setDeletingTag(null)}
          onConfirm={() => {
            removeTag.mutate({ id: deletingTag.id })
            setSelectedTags((current) => {
              const next = new Set(current)
              next.delete(deletingTag.id)
              return next
            })
            setDeletingTag(null)
          }}
        />
      )}

      {deletingCategory && (
        <DeleteCategory
          category={deletingCategory}
          categories={categories}
          activeTaskCount={
            allTasks.filter((task) => task.category_id === deletingCategory.id && task.status === 'active')
              .length
          }
          otherTaskCount={
            allTasks.filter((task) => task.category_id === deletingCategory.id && task.status !== 'active')
              .length
          }
          habitCount={habits.filter((habit) => habit.category_id === deletingCategory.id).length}
          onCancel={() => setDeletingCategory(null)}
          onConfirm={(moveTo) => {
            removeCategory.mutate({ id: deletingCategory.id, moveTo })
            setSelectedCategories((current) => {
              const next = new Set(current)
              next.delete(deletingCategory.id)
              return next
            })
            setDeletingCategory(null)
          }}
        />
      )}
    </>
  )

  const filters = (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FilterRow
          label="Tags"
          empty="None yet"
          options={tags.map((tag) => ({
            id: tag.id,
            label: tag.name,
            onDelete: () => setDeletingTag(tag),
          }))}
          selected={selectedTags}
          onToggle={(id) => setSelectedTags((current) => toggleIn(current, id))}
          action={
            <button
              type="button"
              className="icon-control"
              aria-label="Add or rename tags"
              title="Add or rename tags"
              onClick={() => setManagingTags(true)}
              style={{ width: 22, height: 22 }}
            >
              <PencilIcon size={11} />
            </button>
          }
        />

        <FilterRow
          label="Categories"
          empty="None yet"
          options={categories.map((category) => ({
            id: category.id,
            label: category.name,
            color: slotColor(category.color_slot),
            onDelete: () => setDeletingCategory(category),
          }))}
          selected={selectedCategories}
          onToggle={(id) => setSelectedCategories((current) => toggleIn(current, id))}
          action={
            <button
              type="button"
              className="icon-control"
              aria-label="Add or rename categories"
              title="Add or rename categories"
              onClick={onManageCategories}
              style={{ width: 22, height: 22 }}
            >
              <PencilIcon size={11} />
            </button>
          }
        />
      </div>

      {(selectedTags.size > 0 || selectedCategories.size > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {visible.length} of {tasks.length}
          </span>
          <button
            type="button"
            className="t-control-sm row-edit"
            onClick={() => {
              setSelectedTags(new Set())
              setSelectedCategories(new Set())
            }}
            style={{ color: 'var(--muted)' }}
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  )

  const rows =
    visible.length === 0 ? (
      <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
        Nothing matches.
      </p>
    ) : (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map((task) => (
          <li key={task.id}>
            <TaskListRow
              task={task}
              category={categoryById.get(task.category_id)}
              tags={tagsByTask.get(task.id) ?? []}
              onComplete={onComplete}
              onOpen={onOpen}
              onToggleTag={(id) => setSelectedTags((current) => toggleIn(current, id))}
            />
          </li>
        ))}
      </ul>
    )

  if (besideRail) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {dialogs}
          {filters}
        </div>
        <div style={{ gridColumn: 1, minWidth: 0 }}>{rows}</div>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {dialogs}
      {filters}
      {rows}
    </div>
  )
}

interface TaskListRowProps {
  task: TaskRow
  category?: CategoryRow
  tags: TagRow[]
  onComplete: (task: TaskRow) => void
  onOpen: (task: TaskRow) => void
  onToggleTag: (id: string) => void
}

function TaskListRow({ task, category, tags, onComplete, onOpen, onToggleTag }: TaskListRowProps) {
  // Same contract as the board card: play out, then tell the store.
  const [completing, setCompleting] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function complete() {
    if (completing) return
    setCompleting(true)
    timer.current = window.setTimeout(() => onComplete(task), completionDelay())
  }

  const estimate = taskEstimate(task)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !completing && onOpen(task)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen(task)
      }}
      className={completing ? 'row-card completing' : 'row-card'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderLeft: `2px solid ${slotColor(category?.color_slot ?? 10)}`,
        borderRadius: 'var(--r-card)',
        padding: '8px 10px',
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          className={task.is_instant ? 't-card-title-instant' : 't-row-title'}
          style={{ wordBreak: 'break-word' }}
        >
          {task.title}
        </span>

        <span
          className="t-meta"
          style={{
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          <span>{category?.name ?? 'Unknown'}</span>
          {estimate && <span>· {estimate}</span>}

          {/* Outlined so a tag never reads as more category text. */}
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleTag(tag.id)
              }}
              style={{ ...tagChipStyle, cursor: 'pointer', background: 'transparent' }}
            >
              {tag.name}
            </button>
          ))}
        </span>
      </div>

      <TickButton label={`Complete “${task.title}”`} checked={completing} onActivate={complete} />
    </div>
  )
}

interface FilterRowProps {
  label: string
  empty: string
  options: Array<{ id: string; label: string; color?: string; onDelete?: () => void }>
  selected: Set<string>
  onToggle: (id: string) => void
  /** Sits after the pills, so editing is reachable from where you filter. */
  action: ReactNode
}

function FilterRow({ label, empty, options, selected, onToggle, action }: FilterRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span
        className="t-axis"
        style={{ color: 'var(--muted)', flexShrink: 0, width: LABEL_WIDTH }}
      >
        {label}
      </span>

      {options.length === 0 ? (
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {empty}
        </span>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {options.map((option) => {
            const on = selected.has(option.id)
            return (
              <span
                key={option.id}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                className="pill"
                data-on={on ? 'true' : 'false'}
                onClick={() => onToggle(option.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onToggle(option.id)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  padding: '1px 3px 1px 9px',
                  cursor: 'pointer',
                }}
              >
                <span
                  className="t-control-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 4px 2px 0',
                    color: 'inherit',
                  }}
                >
                  {option.color && (
                    <span
                      aria-hidden
                      style={{ width: 7, height: 7, borderRadius: 2, border: `2px solid ${option.color}` }}
                    />
                  )}
                  {option.label}
                </span>
                {option.onDelete && (
                  <button
                    type="button"
                    className={on ? 'ghost-icon ghost-icon-on' : 'ghost-icon'}
                    aria-label={`Delete ${option.label}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      option.onDelete?.()
                    }}
                    style={{ width: 18, height: 18, color: 'inherit', flexShrink: 0 }}
                  >
                    <CloseIcon size={8} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {action}
    </div>
  )
}

function toggleIn(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

const LABEL_WIDTH = 68

const tagChipStyle: React.CSSProperties = {
  border: '1px solid var(--hairline-strong)',
  borderRadius: 'var(--r-pill)',
  padding: '1px 7px',
  color: 'var(--muted)',
}
