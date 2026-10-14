import { NavLink } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { primaryNavigation } from '../../data/navigation.js'
import { cn } from '../../utils/cn.js'
import { Button } from '../common/Button.jsx'
import { SafeImage } from '../common/SafeImage.jsx'
import { Logo } from './Logo.jsx'

export function SidebarContent({ onNavigate }) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Logo className="px-2 pt-2" />

      <nav aria-label="Primary" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 overscroll-contain">
        <ul className="flex flex-col gap-1">
          {primaryNavigation.map(({ id, label, to, icon: Icon, end }) => (
            <li key={id}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3.5 rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors',
                    isActive
                      ? 'bg-brand-100/80 font-semibold text-navy-900 before:absolute before:inset-y-2.5 before:left-0 before:w-1 before:rounded-full before:bg-accent-500'
                      : 'text-navy-800/85 hover:bg-white/80 hover:text-navy-900',
                  )
                }
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {t(`nav.${id}`, { defaultValue: label })}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <HelpCard onNavigate={onNavigate} />
    </div>
  )
}

function HelpCard({ onNavigate }) {
  const { t } = useTranslation()

  return (
    <div className="rounded-3xl border border-white bg-linear-to-b from-white/90 to-brand-50/90 p-4 text-center shadow-card">
      <SafeImage
        src="/images/ai-assistant.png"
        className="mx-auto size-16 overflow-hidden rounded-full"
        imgClassName="size-full object-cover"
        loading="lazy"
      />
      <p className="mt-2 text-[15px] font-bold text-navy-900">{t('common.need_help')}</p>
      <p className="mt-0.5 text-xs text-muted">{t('common.need_help_desc')}</p>
      <Button to="/copilot" variant="navy" className="mt-4 w-full" onClick={onNavigate}>
        {t('common.chat_now')}
        <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  )
}
