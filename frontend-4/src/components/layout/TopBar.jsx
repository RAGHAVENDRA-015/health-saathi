import { Menu } from 'lucide-react'
import { GlobalSearch } from './GlobalSearch.jsx'
import { Logo } from './Logo.jsx'
import { LanguageSwitcher } from '../common/LanguageSwitcher.jsx'
import { NotificationsMenu } from './NotificationsMenu.jsx'
import { ProfileMenu } from './ProfileMenu.jsx'

export function TopBar({ onOpenNav }) {
  return (
    <header className="flex flex-wrap items-center gap-3 md:flex-nowrap md:gap-4">
      <button
        type="button"
        onClick={onOpenNav}
        className="glass grid size-11 place-items-center rounded-2xl text-navy-900 lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
        <span className="sr-only">Open navigation</span>
      </button>
      <Logo compact className="lg:hidden" />

      <GlobalSearch className="order-last w-full md:order-none md:flex-1 md:max-w-2xl lg:max-w-3xl" />

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <LanguageSwitcher />
        <NotificationsMenu />
        <ProfileMenu />
      </div>
    </header>
  )
}
