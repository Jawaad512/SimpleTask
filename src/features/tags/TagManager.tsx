import { useMemo, useState } from 'react'
import { useTagMutations, useTags, useTaskTags } from '../../data/useTags'
import type { TagRow } from '../../lib/database.types'
import { CloseIcon, PlusIcon } from '../../ui/Icons'
import { Modal } from '../../ui/Modal'
import { DeleteTag } from './DeleteTag'

interface TagManagerProps {
  onClose: () => void
}

/**
 * The tag counterpart to the category manager: create, rename, delete, in one
 * place. Renaming onto a name already in use merges the two rather than
 * failing, which is the only sensible reading of typing an existing name into
 * a field whose values have to be unique.
 */
export function TagManager({ onClose }: TagManagerProps) {
  const { data: tags = [] } = useTags()
  const { data: links = [] } = useTaskTags()
  const { create, rename, remove } = useTagMutations()

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleting, setDeleting] = useState<TagRow | null>(null)

  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const link of links) counts.set(link.tag_id, (counts.get(link.tag_id) ?? 0) + 1)
    return counts
  }, [links])

  if (deleting) {
    return (
      <DeleteTag
        tag={deleting}
        usageCount={usage.get(deleting.id) ?? 0}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          remove.mutate({ id: deleting.id })
          setDeleting(null)
        }}
      />
    )
  }

  const duplicate = tags.some((tag) => tag.name.toLowerCase() === newName.trim().toLowerCase())

  return (
    <Modal title="Tags" onClose={onClose} width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tags.length === 0 && (
          <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
            No tags yet. A tag is a cross-cutting label — a task keeps its one category.
          </p>
        )}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tags.map((tag) => (
            <TagRowItem
              key={tag.id}
              tag={tag}
              usageCount={usage.get(tag.id) ?? 0}
              onRename={(name) => {
                if (name && name !== tag.name) rename.mutate({ id: tag.id, name })
              }}
              onDelete={() => setDeleting(tag)}
            />
          ))}
        </ul>

        {adding ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const name = newName.trim()
              if (!name || duplicate) return
              create.mutate({ name })
              setNewName('')
              setAdding(false)
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setAdding(false)
              }}
              placeholder="Tag name"
              aria-label="New tag name"
              maxLength={32}
              className="t-row-title field"
              style={{ padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
            />

            {duplicate && newName.trim() !== '' && (
              <p className="t-meta" style={{ color: 'var(--muted)', margin: 0 }}>
                That tag already exists.
              </p>
            )}

            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="t-control btn btn-quiet"
                style={{ padding: '6px 12px' }}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="t-control btn btn-primary"
                disabled={!newName.trim() || duplicate}
                style={{ padding: '6px 12px', opacity: newName.trim() && !duplicate ? 1 : 0.35 }}
              >
                Create
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="t-control btn btn-quiet"
            onClick={() => setAdding(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 12px',
            }}
          >
            <PlusIcon size={10} /> New tag
          </button>
        )}
      </div>
    </Modal>
  )
}

interface TagRowProps {
  tag: TagRow
  usageCount: number
  onRename: (name: string) => void
  onDelete: () => void
}

function TagRowItem({ tag, usageCount, onRename, onDelete }: TagRowProps) {
  const [draft, setDraft] = useState(tag.name)

  return (
    <li
      style={{
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-card)',
        background: 'var(--surface)',
        padding: 7,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onRename(draft.trim())}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setDraft(tag.name)
        }}
        aria-label={`Rename ${tag.name}`}
        maxLength={32}
        className="t-row-title field-bare"
        style={{ flex: 1, minWidth: 0, padding: '6px 8px' }}
      />

      <span
        className="t-meta"
        title={`On ${usageCount} ${usageCount === 1 ? 'task' : 'tasks'}`}
        style={{ flexShrink: 0, color: 'var(--muted)' }}
      >
        {usageCount}
      </span>

      <button
        type="button"
        className="ghost-icon"
        aria-label={`Delete ${tag.name}`}
        onClick={onDelete}
        style={{ width: 24, height: 24, flexShrink: 0 }}
      >
        <CloseIcon />
      </button>
    </li>
  )
}
