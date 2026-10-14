import { Link } from 'react-router-dom'
import { Heart, Plus } from 'lucide-react'
import { cn } from '../../utils/cn.js'

export function Logo({ compact = false, className }) {
  return (
    <Link to="/" className={cn('flex items-center gap-3 rounded-xl', className)}>
      <span aria-hidden="true" className="relative grid size-11 shrink-0 place-items-center">
        <Heart className="size-11 fill-brand-600 text-brand-600 drop-shadow-[0_6px_10px_rgb(18_127_192/0.35)]" strokeWidth={1.5} />
        <Plus className="absolute size-5 text-accent-400" strokeWidth={4} />
      </span>
      <span className={cn('flex flex-col leading-tight', compact && 'max-sm:sr-only')}>
        <span className="text-xl font-extrabold tracking-tight text-navy-900">HealthSaathi</span>
        {!compact && <span className="text-xs font-medium text-brand-600">AI Personal Health Copilot</span>}
      </span>
    </Link>
  )
}
