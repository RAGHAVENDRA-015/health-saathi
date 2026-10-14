import { Bone, ClipboardList, File, FileText, ScanLine } from 'lucide-react'
import { cn } from '../../utils/cn.js'

const visuals = {
  lab: { icon: FileText, className: 'bg-brand-100 text-brand-600' },
  diagnostic: { icon: ScanLine, className: 'bg-emerald-50 text-emerald-600' },
  prescription: { icon: ClipboardList, className: 'bg-rose-50 text-rose-500' },
  imaging: { icon: Bone, className: 'bg-indigo-50 text-navy-800' },
  other: { icon: File, className: 'bg-ice-100 text-muted' },
}

export function DocumentIcon({ type, size = 'md' }) {
  const { icon: Icon, className } = visuals[type] ?? visuals.other
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-xl',
        size === 'lg' ? 'size-14 rounded-2xl' : 'size-10',
        className,
      )}
    >
      <Icon className={size === 'lg' ? 'size-6' : 'size-[18px]'} />
    </span>
  )
}
