import type { TagRow } from '../../lib/database.types'
import { Modal } from '../../ui/Modal'

interface DeleteTagProps {
  tag: TagRow
  usageCount: number
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteTag({ tag, usageCount, onCancel, onConfirm }: DeleteTagProps) {
  return (
    <Modal title={`Delete “${tag.name}”`} onClose={onCancel} width={360}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="t-row-title" style={{ margin: 0 }}>
          {usageCount > 0
            ? `It will come off ${usageCount} ${usageCount === 1 ? 'task' : 'tasks'}.`
            : 'Nothing uses this tag.'}
        </p>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="t-control btn btn-quiet"
            style={{ padding: '6px 12px' }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="t-control btn btn-danger"
            style={{ padding: '6px 12px' }}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </Modal>
  )
}
