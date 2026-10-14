import { FileUp, MessageCircleHeart, Sparkles } from 'lucide-react'
import { Button } from '../common/Button.jsx'
import { Modal } from '../common/Modal.jsx'

const steps = [
  {
    icon: FileUp,
    title: 'Upload your documents',
    description: 'Add lab reports, prescriptions and scans as PDF or images. Everything is organized automatically.',
  },
  {
    icon: Sparkles,
    title: 'Get AI explanations',
    description: 'HealthSaathi reads your reports and highlights values outside their reference range in plain language.',
  },
  {
    icon: MessageCircleHeart,
    title: 'Ask follow-up questions',
    description: 'Chat with the AI Health Copilot and prepare better questions for your next doctor visit.',
  },
]

export function HowItWorksDialog({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How HealthSaathi works"
      description="Three simple steps from paperwork to clarity."
    >
      <ol className="flex flex-col gap-4 px-6 pt-5">
        {steps.map(({ icon: Icon, title, description }, index) => (
          <li key={title} className="flex gap-4 rounded-2xl border border-ice-200 bg-ice-50/70 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold text-brand-600">Step {index + 1}</p>
              <p className="text-[15px] font-bold text-navy-900">{title}</p>
              <p className="mt-1 text-sm text-muted">{description}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="px-6 pt-4 text-xs text-muted">
        HealthSaathi offers educational insights and does not replace professional medical advice.
      </p>
      <div className="flex justify-end gap-3 px-6 pt-5 pb-6">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button to="/upload" onClick={onClose}>
          Upload a document
        </Button>
      </div>
    </Modal>
  )
}
