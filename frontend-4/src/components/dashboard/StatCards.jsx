import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, FileText, FlaskConical, ImageIcon, Minus, TrendingUp } from 'lucide-react'
import { useHealthData } from '../../context/HealthDataContext.jsx'
import { cn } from '../../utils/cn.js'

const statConfig = [
  { key: 'total', labelKey: 'records.total_records', defaultLabel: 'Total Records', icon: FileText, tile: 'bg-brand-100 text-brand-600', to: '/records' },
  { key: 'lab', labelKey: 'records.lab_reports', defaultLabel: 'Lab Reports', icon: FlaskConical, tile: 'bg-brand-100 text-brand-600', to: '/records?category=lab' },
  {
    key: 'prescription',
    labelKey: 'records.prescriptions',
    defaultLabel: 'Prescriptions',
    icon: ClipboardList,
    tile: 'bg-amber-50 text-amber-500',
    to: '/records?category=prescription',
  },
  { key: 'scan', labelKey: 'records.scans_others', defaultLabel: 'Scans & Others', icon: ImageIcon, tile: 'bg-violet-50 text-violet-500', to: '/records?category=scan' },
]

export function StatCards() {
  const { t } = useTranslation()
  const { stats } = useHealthData()

  return (
    <section aria-label="Record summary">
      <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {statConfig.map(({ key, labelKey, defaultLabel, icon: Icon, tile, to }) => {
          const { count, addedThisPeriod } = stats[key]
          return (
            <li key={key}>
              <Link
                to={to}
                className="panel group relative flex items-center gap-4 overflow-hidden p-4 transition-shadow hover:shadow-pop sm:p-5"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -bottom-10 size-28 rounded-full bg-brand-100/50 blur-2xl"
                />
                <span className={cn('grid size-14 shrink-0 place-items-center rounded-2xl', tile)}>
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="relative min-w-0">
                  <span className="block text-sm font-medium text-muted">{t(labelKey, defaultLabel)}</span>
                  <span className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
                    <span className="text-3xl font-extrabold tabular-nums text-navy-900">{count}</span>
                    {addedThisPeriod > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <TrendingUp className="size-3.5" aria-hidden="true" />+{addedThisPeriod} {t('dashboard.this_month', 'this month')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                        <Minus className="size-3.5" aria-hidden="true" />
                        {t('dashboard.no_change', 'No change')}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
