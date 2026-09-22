import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState } from 'react'
import { newId } from '../../data/keys'
import { useCategories, useCategoryMutations } from '../../data/useCategories'
import { useHabits } from '../../data/useHabits'
import { useTasks } from '../../data/useTasks'
import type { CategoryRow } from '../../lib/database.types'
import { SLOT_COUNT, slotColor } from '../../lib/palette'
import { CloseIcon, GripIcon, PlusIcon } from '../../ui/Icons'
import { Modal } from '../../ui/Modal'
import { SlotPicker } from './SlotPicker'

interface CategoryManagerProps {
  onClose: () => void
}

export function CategoryManager({ onClose }: CategoryManagerProps) {
  const { data: categories = [] } = useCategories()
  const { data: tasks = [] } = useTasks()
  const { data: habits = [] } = useHabits()
  const { create, rename, recolour, reorder, remove } = useCategoryMutations()

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlot, setNewSlot] = useState<number | null>(null)
  const [recolouring, setRecolouring] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CategoryRow | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const takenBy = useMemo(
    () => new Map(categories.map((category) => [category.color_slot, category.name])),
    [categories],
  )

  const freeSlot = useMemo(() => {
    for (let slot = 1; slot <= SLOT_COUNT; slot += 1) if (!takenBy.has(slot)) return slot
    return null
  }, [takenBy])

  const full = categories.length >= SLOT_COUNT

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = categories.findIndex((category) => category.id === active.id)
    const to = categories.findIndex((category) => category.id === over.id)
    if (from === -1 || to === -1) return

    reorder.mutate({ ids: arrayMove(categories, from, to).map((category) => category.id) })
  }

  if (deleting) {
    return (
      <DeleteCategory
        category={deleting}
        categories={categories}
        activeTaskCount={
          tasks.filter((task) => task.category_id === deleting.id && task.status === 'active').length
        }
        otherTaskCount={
          tasks.filter((task) => task.category_id === deleting.id && task.status !== 'active').length
        }
        habitCount={habits.filter((habit) => habit.category_id === deleting.id).length}
        onCancel={() => setDeleting(null)}
        onConfirm={(moveTo) => {
          remove.mutate({ id: deleting.id, moveTo })
          setDeleting(null)
        }}
      />
    )
  }

  return (
    <Modal title="Categories" onClose={onClose} width={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {categories.length === 0 && (
          <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
            No categories yet. Every task belongs to exactly one.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={categories.map((category) => category.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {categories.map((category) => (
                <CategoryRowItem
                  key={category.id}
                  category={category}
                  takenBy={takenBy}
                  expanded={recolouring === category.id}
                  onToggleRecolour={() =>
                    setRecolouring(recolouring === category.id ? null : category.id)
                  }
                  onRename={(name) => {
                    if (name && name !== category.name) rename.mutate({ id: category.id, name })
                  }}
                  onRecolour={(slot) => {
                    recolour.mutate({ id: category.id, colorSlot: slot })
                    setRecolouring(null)
                  }}
                  onDelete={() => setDeleting(category)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {adding ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-card)',
              padding: 10,
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Category name"
              aria-label="New category name"
              className="t-row-title field"
              style={fieldLayout}
            />

            <SlotPicker value={newSlot ?? freeSlot} takenBy={takenBy} onPick={setNewSlot} />

            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="t-control btn btn-quiet"
                style={buttonBox}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="t-control btn btn-primary"
                style={{ ...buttonBox, opacity: newName.trim() ? 1 : 0.35 }}
                disabled={!newName.trim()}
                onClick={() => {
                  const slot = newSlot ?? freeSlot
                  if (!slot) return
                  create.mutate({
                    id: newId(),
                    name: newName.trim(),
                    colorSlot: slot,
                    position: categories.length,
                  })
                  setNewName('')
                  setNewSlot(null)
                  setAdding(false)
                }}
              >
                Create
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <button
              type="button"
              className="t-control btn btn-quiet"
              disabled={full}
              onClick={() => {
                setNewSlot(freeSlot)
                setAdding(true)
              }}
              style={{
                ...buttonBox,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: full ? 0.4 : 1,
              }}
            >
              <PlusIcon size={10} /> New category
            </button>

            {full && (
              <p className="t-meta" style={{ color: 'var(--muted)', margin: 0, textAlign: 'center' }}>
                All {SLOT_COUNT} colours are in use.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

interface RowProps {
  category: CategoryRow
  takenBy: Map<number, string>
  expanded: boolean
  onToggleRecolour: () => void
  onRename: (name: string) => void
  onRecolour: (slot: number) => void
  onDelete: () => void
}

function CategoryRowItem({
  category,
  takenBy,
  expanded,
  onToggleRecolour,
  onRename,
  onRecolour,
  onDelete,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  })
  const [draft, setDraft] = useState(category.name)

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-card)',
        background: 'var(--surface)',
        padding: 7,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="ghost-icon"
          aria-label={`Reorder ${category.name}`}
          {...attributes}
          {...listeners}
          style={{ width: 22, height: 22, cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
        >
          <GripIcon />
        </button>

        <button
          type="button"
          className="swatch"
          aria-label={`Change colour of ${category.name}`}
          aria-expanded={expanded}
          onClick={onToggleRecolour}
          style={{
            width: 18,
            height: 18,
            flexShrink: 0,
            borderRadius: 4,
            border: `2px solid ${slotColor(category.color_slot)}`,
          }}
        />

        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => onRename(draft.trim())}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setDraft(category.name)
          }}
          aria-label={`Rename ${category.name}`}
          maxLength={40}
          className="t-row-title field-bare"
          style={{ flex: 1, minWidth: 0, padding: '6px 8px' }}
        />

        <button
          type="button"
          className="ghost-icon"
          aria-label={`Delete ${category.name}`}
          onClick={onDelete}
          style={{ width: 24, height: 24, flexShrink: 0 }}
        >
          <CloseIcon />
        </button>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SlotPicker value={category.color_slot} takenBy={takenBy} allowSwap onPick={onRecolour} />
          <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
            Picking a colour another category holds swaps the two.
          </p>
        </div>
      )}
    </li>
  )
}

interface DeleteProps {
  category: CategoryRow
  categories: CategoryRow[]
  activeTaskCount: number
  otherTaskCount: number
  habitCount: number
  onCancel: () => void
  onConfirm: (moveTo: string | null) => void
}

export function DeleteCategory({
  category,
  categories,
  activeTaskCount,
  otherTaskCount,
  habitCount,
  onCancel,
  onConfirm,
}: DeleteProps) {
  const destinations = categories.filter((candidate) => candidate.id !== category.id)
  const [moveTo, setMoveTo] = useState(destinations[0]?.id ?? '')

  const occupied = activeTaskCount + otherTaskCount + habitCount > 0

  return (
    <Modal title={`Delete “${category.name}”`} onClose={onCancel} width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="t-row-title" style={{ margin: 0 }}>
          {occupied
            ? `${plural(activeTaskCount, 'active task')} and ${plural(habitCount, 'habit')} use this category.`
            : 'Nothing uses this category.'}
        </p>

        {otherTaskCount > 0 && (
          <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
            {plural(otherTaskCount, 'completed task')} in the last 24 hours still reference it.
          </p>
        )}

        {occupied ? (
          destinations.length > 0 ? (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span className="t-axis" style={{ color: 'var(--muted)' }}>
                  Move them to
                </span>
                <select
                  value={moveTo}
                  onChange={(event) => setMoveTo(event.target.value)}
                  className="t-row-title field"
                  style={fieldLayout}
                >
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" className="t-control btn btn-quiet" style={buttonBox} onClick={onCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="t-control btn btn-danger"
                  style={buttonBox}
                  onClick={() => onConfirm(moveTo)}
                >
                  Move, then delete
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
                There is nowhere to move them. Create another category first, or delete the tasks.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="t-control btn btn-quiet" style={buttonBox} onClick={onCancel}>
                  Close
                </button>
              </div>
            </>
          )
        ) : (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" className="t-control btn btn-quiet" style={buttonBox} onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="t-control btn btn-danger"
              style={buttonBox}
              onClick={() => onConfirm(null)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/* Colour, border and hover live on .field and .btn-* in index.css; an inline
   background would outrank every one of those rules. Only metrics here. */
const fieldLayout: React.CSSProperties = {
  padding: '6px 8px',
  width: '100%',
  boxSizing: 'border-box',
}

const buttonBox: React.CSSProperties = {
  padding: '6px 12px',
}
