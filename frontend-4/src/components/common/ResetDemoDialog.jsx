import { useHealthData } from '../../context/HealthDataContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ConfirmDialog } from './ConfirmDialog.jsx'

export function ResetDemoDialog({ open, onClose }) {
  const { resetDemoData } = useHealthData()
  const { notify } = useToast()

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Reset demo data?"
      description="This restores the sample records and clears uploads, read notifications and recent searches saved on this device."
      confirmLabel="Reset demo data"
      onConfirm={() => {
        resetDemoData()
        notify({ title: 'Demo data restored', description: 'Sample records are back to their original state.' })
      }}
    />
  )
}
