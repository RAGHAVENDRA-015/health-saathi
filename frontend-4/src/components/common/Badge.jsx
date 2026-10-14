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

const labTones = {
  normal: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-bold',
  low: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 font-bold',
  high: 'bg-amber-50 text-amber-800 ring-1 ring-amber-300 font-bold',
  critical: 'bg-rose-100 text-rose-800 ring-1 ring-rose-400 font-extrabold animate-pulse',
  reported: 'bg-ice-100 text-muted ring-1 ring-ice-200',
  unavailable: 'bg-ice-100 text-muted ring-1 ring-ice-200',
}

export function LabStatusBadge({ status, className }) {
  const norm = String(status || '').trim().toLowerCase()

  if (norm === 'critical' || norm === 'critical alert' || norm === 'panic') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-wide bg-rose-100 text-rose-800 ring-1 ring-rose-400 shadow-xs animate-pulse whitespace-nowrap',
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-rose-600" aria-hidden="true" />
        Critical
      </span>
    )
  }

  if (norm === 'high' || norm === 'elevated' || norm === 'above range') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-amber-50 text-amber-800 ring-1 ring-amber-300 shadow-xs whitespace-nowrap',
          className
        )}
      >
        <span className="text-[10px]" aria-hidden="true">▲</span>
        High
      </span>
    )
  }

  if (norm === 'low' || norm === 'below range' || norm === 'deficient') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-sky-50 text-sky-700 ring-1 ring-sky-200 shadow-xs whitespace-nowrap',
          className
        )}
      >
        <span className="text-[10px]" aria-hidden="true">▼</span>
        Low
      </span>
    )
  }

  if (norm === 'normal' || norm === 'within range' || norm === 'optimal') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 shadow-xs whitespace-nowrap',
          className
        )}
      >
        <span className="text-[10px]" aria-hidden="true">✓</span>
        Normal
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-ice-100 text-muted ring-1 ring-ice-200 whitespace-nowrap',
        className
      )}
    >
      {LAB_STATUSES[norm]?.label || 'Reported'}
    </span>
  )
}
