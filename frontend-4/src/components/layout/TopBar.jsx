import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { GlobalSearch } from './GlobalSearch.jsx'
import { Logo } from './Logo.jsx'
import { LanguageSwitcher } from '../common/LanguageSwitcher.jsx'
import { NotificationsMenu } from './NotificationsMenu.jsx'
import { ProfileMenu } from './ProfileMenu.jsx'
import { cn } from '../../utils/cn.js'

export function TopBar({ onOpenNav }) {
  const location = useLocation()
  const isCopilot = location.pathname.startsWith('/copilot')

  return (
    <header className="flex flex-wrap items-center gap-2 sm:gap-3 md:flex-nowrap md:gap-4">
      <button
        type="button"
        onClick={onOpenNav}
        className="glass grid size-10 sm:size-11 shrink-0 place-items-center rounded-xl sm:rounded-2xl text-navy-900 lg:hidden cursor-pointer"
      >
        <Menu className="size-5" aria-hidden="true" />
        <span className="sr-only">Open navigation</span>
      </button>
      <Logo compact className="lg:hidden shrink-0" />

      <GlobalSearch
        className={cn(
          'order-last w-full md:order-none md:flex-1 md:max-w-2xl lg:max-w-3xl',
          isCopilot && 'hidden md:block'
        )}
      />

      <div className="ml-auto flex items-center gap-1.5 sm:gap-3 shrink-0">
        <LanguageSwitcher />
        <NotificationsMenu />
        <ProfileMenu />
      </div>
    </header>
  )
}
