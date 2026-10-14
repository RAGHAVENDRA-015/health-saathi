export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-sm font-semibold text-brand-600">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 text-balance sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-pretty text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  )
}
