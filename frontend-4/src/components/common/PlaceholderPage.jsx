import { ArrowLeft, CircleDashed } from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { Badge } from './Badge.jsx'
import { Button } from './Button.jsx'

export function PlaceholderPage({ title, description, phase, icon: Icon, plannedFeatures = [], children }) {
  useDocumentTitle(title)

  return (
    <div className="flex flex-col gap-5">
      <section className="panel relative overflow-hidden p-6 sm:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-200/40 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <Badge tone="lime">Planned for {phase}</Badge>
            <div className="mt-5 flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-600">
                <Icon className="size-7" aria-hidden="true" />
              </span>
              <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
            </div>
            <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted">{description}</p>
            <div className="mt-6">
              <Button to="/dashboard" variant="secondary">
                <ArrowLeft aria-hidden="true" />
                Back to Dashboard
              </Button>
            </div>
          </div>

          {plannedFeatures.length > 0 && (
            <div className="w-full rounded-2xl border border-ice-200 bg-ice-50/80 p-5 lg:max-w-sm">
              <h2 className="text-sm font-bold text-navy-900">What&apos;s coming</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {plannedFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-muted">
                    <CircleDashed className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
      {children}
    </div>
  )
}
