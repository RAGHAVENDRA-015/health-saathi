import { Droplet, Droplets, HeartPulse, Sun } from 'lucide-react'
import { cn } from '../../utils/cn.js'

const icons = {
  droplet: { icon: Droplet, className: 'bg-emerald-50 text-emerald-600' },
  droplets: { icon: Droplets, className: 'bg-brand-100 text-brand-600' },
  heart: { icon: HeartPulse, className: 'bg-rose-50 text-rose-500' },
  sun: { icon: Sun, className: 'bg-amber-50 text-amber-500' },
}

export function LabValueIcon({ name }) {
  const { icon: Icon, className } = icons[name] ?? icons.droplet
  return (
    <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-xl', className)}>
      <Icon className="size-5" />
    </span>
  )
}
