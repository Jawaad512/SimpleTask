import { useMemo, useState, type FormEvent } from 'react'
import { useTagMutations, useTags, useTaskTags } from '../../data/useTags'
import type { CategoryRow, TagRow, TaskRow } from '../../lib/database.types'
import {
  DURATION_MAX,
  INSTANT_MINUTES,
  QUICK_MAX,
  effectiveMinutes,
  formatEstimate,
  isInstantFor,
  isQuickFor,
  parseMinutes,
} from '../../lib/duration'
import { slotColor } from '../../lib/palette'
import { CloseIcon } from '../../ui/Icons'
import { Modal } from '../../ui/Modal'
import { Segmented } from '../../ui/Segmented'
import { useLayout } from '../../ui/Layout'
import { DeleteTag } from '../tags/DeleteTag'
import { TagManager } from '../tags/TagManager'

interface TaskSheetProps {
  task: TaskRow
  category?: CategoryRow
  categories: CategoryRow[]
  onClose: () => void
  onSetTitle: (task: TaskRow, title: string) => void
  onSetEstimate: (task: TaskRow, minutes: number | null) => void
  onSetAxes: (task: TaskRow, axes: { isToday: boolean; isQuick: boolean }) => void
  onSetCategory: (task: TaskRow, categoryId: string) => void
  onComplete: (task: TaskRow) => void
  onDelete: (task: TaskRow) => void
}

/**
 * The sheet is an editor, so its own fields are a draft until Save — the grid
 * behind it should not shuffle under the pointer while a number is half typed.
 *
 * Tags are the exception, and deliberately: a chip you click is its own commit,
 * and a tag you add is wanted the moment you add it.
 */
export function TaskSheet({
  task,
  category,
  categories,
  onClose,
  onSetTitle,
  onSetEstimate,
  onSetAxes,
  onSetCategory,
  onComplete,
  onDelete,
}: TaskSheetProps) {
  const { isPhone } = useLayout()
  const { data: tags = [] } = useTags()
  const { data: links = [] } = useTaskTags()
  const { toggle, createAndApply, remove } = useTagMutations()
  const [draft, setDraft] = useState('')
  const [deletingTag, setDeletingTag] = useState<TagRow | null>(null)
  const [managingTags, setManagingTags] = useState(false)

  const [title, setTitle] = useState(task.title)
  const saved = effectiveMinutes(task)
  const [minutes, setMinutes] = useState(saved === null ? '' : String(saved))
  const [isToday, setIsToday] = useState(task.is_today)
  const [isQuick, setIsQuick] = useState(task.is_quick)
  const [categoryId, setCategoryId] = useState(task.category_id)

  const parsed = parseMinutes(minutes)
  // The flag is not a separate fact — it is what an estimate under five minutes
  // looks like. One control, one value, no way for the two to disagree.
  const instant = parsed !== null && isInstantFor(parsed)
  const nextQuick = parsed === null ? isQuick : isQuickFor(parsed)

  const trimmedTitle = title.trim()
  // A task with no name is not a task, so an empty field is a change the sheet
  // refuses to save rather than one it quietly drops.
  const named = trimmedTitle.length > 0
  const titleChanged = named && trimmedTitle !== task.title

  const axesChanged = isPhone && (isToday !== task.is_today || nextQuick !== task.is_quick)
  const estimateChanged = parsed !== saved
  const categoryChanged = categoryId !== task.category_id
  const dirty = titleChanged || estimateChanged || axesChanged || categoryChanged
  const chosenCategory =
    categories.find((row) => row.id === categoryId) ??
    (categoryId === category?.id ? category : undefined)

  const applied = useMemo(
    () => new Set(links.filter((link) => link.task_id === task.id).map((link) => link.tag_id)),
    [links, task.id],
  )

  function addTag(event: FormEvent) {
    event.preventDefault()
    const name = draft.trim()
    if (!name) return
    createAndApply.mutate({ taskId: task.id, name })
    setDraft('')
  }

  function save() {
    if (!named) return
    if (titleChanged) onSetTitle(task, trimmedTitle)
    // Estimate first, axes last: the axes move recomputes the position for the
    // quadrant the task actually ends up in, which the estimate may have changed.
    if (estimateChanged) onSetEstimate(task, parsed)
    if (categoryChanged) onSetCategory(task, categoryId)
    if (axesChanged) onSetAxes(task, { isToday, isQuick: nextQuick })
    onClose()
  }

  return (
    <Modal title="Task" onClose={onClose} width={380}>
      {deletingTag && (
        <DeleteTag
          tag={deletingTag}
          usageCount={links.filter((link) => link.tag_id === deletingTag.id).length}
          onCancel={() => setDeletingTag(null)}
          onConfirm={() => {
            remove.mutate({ id: deletingTag.id })
            setDeletingTag(null)
          }}
        />
      )}

      {managingTags && <TagManager onClose={() => setManagingTags(false)} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* The name is the first thing you came here to change, so it is a
              field, not a heading — bare until you touch it. */}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (dirty) save()
              }
              if (event.key === 'Escape') {
                // Put the name back rather than closing the sheet over a
                // half-typed one.
                event.stopPropagation()
                setTitle(task.title)
              }
            }}
            aria-label="Task name"
            placeholder="Task name"
            maxLength={200}
            className={`${instant ? 't-card-title-instant' : 't-row-title'} field-bare`}
            // The negative margin and the matching width keep the text on the
            // same left edge as the category row below it: a field, but not an
            // indent.
            style={{ width: 'calc(100% + 14px)', padding: '5px 7px', margin: '-5px -7px 0' }}
          />
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--muted)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                flexShrink: 0,
                border: `2px solid ${slotColor(chosenCategory?.color_slot ?? 10)}`,
              }}
            />
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-label="Category"
              className="t-control-sm field"
              style={{ flex: 1, minWidth: 0, padding: '6px 8px' }}
            >
              {chosenCategory && !categories.some((row) => row.id === chosenCategory.id) && (
                <option value={chosenCategory.id}>{chosenCategory.name}</option>
              )}
              {categories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4 className="t-axis" style={{ margin: 0, color: 'var(--muted)' }}>
            Estimate
          </h4>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              value={minutes}
              onChange={(event) => setMinutes(event.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (dirty) save()
                }
                if (event.key === 'Escape') {
                  // Revert the field rather than closing the sheet out from
                  // under a half-typed number.
                  event.stopPropagation()
                  setMinutes(saved === null ? '' : String(saved))
                }
              }}
              inputMode="numeric"
              maxLength={4}
              max={DURATION_MAX}
              placeholder="—"
              aria-label="Estimated minutes"
              className="t-row-title field"
              style={{
                width: 72,
                padding: '6px 8px',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <span className="t-meta" style={{ color: 'var(--muted)' }}>
              minutes
            </span>

            {minutes !== '' && (
              <button
                type="button"
                className="t-control-sm btn btn-quiet"
                onClick={() => setMinutes('')}
                style={{ marginLeft: 'auto', padding: '5px 10px' }}
              >
                Clear
              </button>
            )}
          </div>

          <label
            style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={instant}
              onChange={(event) =>
                setMinutes(event.target.checked ? String(INSTANT_MINUTES) : '')
              }
              style={{ marginTop: 2, accentColor: 'var(--ink)' }}
            />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="t-row-title">Under 5 minutes</span>
              <span className="t-meta" style={{ color: 'var(--muted)' }}>
                Bold on the board — do it now
              </span>
            </span>
          </label>

          <span className="t-meta" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
            {parsed === null
              ? 'No estimate — the card shows nothing and drags anywhere.'
              : `Shows as ${formatEstimate(parsed)}, and holds the task in the ${
                  parsed < QUICK_MAX ? 'under-20-min' : '20-min-plus'
                } column.`}
          </span>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <h4 className="t-axis" style={{ margin: 0, color: 'var(--muted)' }}>
              Tags
            </h4>
            <button
              type="button"
              className="t-control-sm row-edit"
              onClick={() => setManagingTags(true)}
              style={{ color: 'var(--muted)' }}
            >
              Edit tags
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {tags.length === 0 && (
              <span className="t-meta" style={{ color: 'var(--muted)' }}>
                No tags yet.
              </span>
            )}
            {tags.map((tag) => {
              const on = applied.has(tag.id)
              return (
                <span
                  key={tag.id}
                  className="pill"
                  data-on={on ? 'true' : 'false'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '1px 3px 1px 9px',
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle.mutate({ taskId: task.id, tagId: tag.id, on: !on })}
                    className="t-control-sm"
                    style={{ padding: '3px 4px 3px 0', color: 'inherit' }}
                  >
                    {tag.name}
                  </button>
                  <button
                    type="button"
                    className={on ? 'ghost-icon ghost-icon-on' : 'ghost-icon'}
                    aria-label={`Delete ${tag.name}`}
                    onClick={() => setDeletingTag(tag)}
                    style={{ width: 18, height: 18, color: 'inherit', flexShrink: 0 }}
                  >
                    <CloseIcon size={8} />
                  </button>
                </span>
              )
            })}
          </div>

          <form onSubmit={addTag} style={{ display: 'flex', gap: 6 }}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="New tag"
              aria-label="New tag"
              className="t-control-sm field"
              style={{ flex: 1, minWidth: 0, padding: '6px 8px' }}
            />
            <button
              type="submit"
              className="t-control-sm btn btn-quiet"
              disabled={!draft.trim()}
              style={{ padding: '6px 12px', opacity: draft.trim() ? 1 : 0.35 }}
            >
              Add
            </button>
          </form>
        </section>

        {/* Phone only. On desktop, dragging already does this and the duplicate
            is clutter. */}
        {isPhone && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Segmented
              label="Effort"
              value={nextQuick ? 'quick' : 'long'}
              disabled={parsed !== null}
              hint={parsed !== null ? 'The estimate decides this. Clear it to choose by hand.' : undefined}
              options={[
                { value: 'quick', label: 'Under 20 min' },
                { value: 'long', label: '20 min +' },
              ]}
              onChange={(value) => setIsQuick(value === 'quick')}
            />
            <Segmented
              label="When"
              value={isToday ? 'today' : 'later'}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'later', label: 'Later' },
              ]}
              onChange={(value) => setIsToday(value === 'today')}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="t-control btn btn-primary"
            disabled={!dirty || !named}
            style={{ padding: '9px 12px', opacity: dirty && named ? 1 : 0.35 }}
            onClick={save}
          >
            {!named ? 'Name the task to save' : dirty ? 'Save changes' : 'No changes to save'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="t-control btn btn-done"
              style={{ flex: 1, padding: '8px 12px' }}
              onClick={() => {
                onComplete(task)
                onClose()
              }}
            >
              Mark done
            </button>
            <button
              type="button"
              className="t-control btn btn-danger"
              style={{ padding: '8px 12px' }}
              onClick={() => {
                onDelete(task)
                onClose()
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
