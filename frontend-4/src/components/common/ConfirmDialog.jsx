import { Button } from './Button.jsx'
import { Modal } from './Modal.jsx'

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, tone = 'danger' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="flex flex-col-reverse gap-3 px-6 pt-5 pb-6 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'navy'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
