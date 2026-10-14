import { cn } from '../../utils/cn.js'
import { getDocumentTypeLabel, getStatusLabel } from '../../utils/documents.js'
import { LAB_STATUSES } from '../../data/mockReports.js'

const tones = {
  brand: 'bg-brand-100/80 text-brand-700',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  danger: 'bg-rose-50 text-rose-600 ring-1 ring-rose-100',
  neutral: 'bg-ice-100 text-muted',
  lime: 'bg-accent-300/60 text-navy-900',
}

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const statusTones = { analyzed: 'success', ready: 'success', processing: 'warning', pending: 'brand', failed: 'danger' }

export function StatusBadge({ status }) {
  return <Badge tone={statusTones[status] ?? 'neutral'}>{getStatusLabel(status)}</Badge>
}

export function TypeBadge({ type }) {
  return <Badge tone="brand">{getDocumentTypeLabel(type)}</Badge>
}

const labTones = { normal: 'success', low: 'warning', high: 'danger' }

export function LabStatusBadge({ status }) {
  return <Badge tone={labTones[status] ?? 'neutral'}>{LAB_STATUSES[status]?.label ?? 'Unknown'}</Badge>
}
