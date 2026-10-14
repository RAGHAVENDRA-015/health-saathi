import { cn } from '../../utils/cn.js'

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {Icon && (
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-100 text-brand-600">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <h3 className="mt-4 text-base font-bold text-navy-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-pretty text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
