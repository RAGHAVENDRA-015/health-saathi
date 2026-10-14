import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, FileUp, LogOut, RotateCcw, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHealthData } from '../../context/HealthDataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Dropdown, DropdownItem } from '../common/Dropdown.jsx'
import { ResetDemoDialog } from '../common/ResetDemoDialog.jsx'
import { SafeImage } from '../common/SafeImage.jsx'

function getInitials(name) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ProfileMenu() {
  const { t } = useTranslation()
  const { user } = useHealthData()
  const { isLiveAuth, logout } = useAuth()
  const navigate = useNavigate()
  const [isResetOpen, setIsResetOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = getInitials(user?.displayName || user?.fullName || user?.email)

  return (
    <>
      <Dropdown
        panelClassName="w-64"
        renderTrigger={({ triggerProps, open }) => (
          <button
            type="button"
            {...triggerProps}
            className="flex items-center gap-2.5 rounded-2xl py-1 pr-2 pl-1 hover:bg-white/70"
          >
            {user?.avatar ? (
              <SafeImage
                src={user.avatar}
                alt={user.displayName || 'Profile avatar'}
                fallbackIcon={UserRound}
                className="size-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-xs"
                imgClassName="size-full object-cover"
              />
            ) : (
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-600 to-navy-800 text-sm font-bold text-white shadow-xs ring-2 ring-white">
                {initials}
              </div>
            )}
            <span className="hidden text-[15px] font-semibold text-navy-900 sm:inline">{user?.displayName || user?.fullName || 'User'}</span>
            <ChevronDown
              className={`size-4 text-navy-800 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            <span className="sr-only">Open account menu</span>
          </button>
        )}
      >
        {({ close }) => (
          <div>
            <div className="border-b border-ice-100 px-3 pt-2 pb-3">
              <p className="text-sm font-bold text-navy-900">{user.displayName}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
              <p className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-brand-100 text-brand-700">
                {t('topbar.verified_account')}
              </p>
            </div>
            <div className="flex flex-col gap-0.5 pt-2">
              <DropdownItem as={Link} to="/profile" icon={UserRound} onClick={close}>
                {t('topbar.my_profile')}
              </DropdownItem>
              <DropdownItem as={Link} to="/upload" icon={FileUp} onClick={close}>
                {t('topbar.upload_document')}
              </DropdownItem>
              <DropdownItem
                icon={LogOut}
                onClick={async () => {
                  close()
                  await handleLogout()
                }}
              >
                {t('topbar.sign_out')}
              </DropdownItem>
            </div>
          </div>
        )}
      </Dropdown>
      <ResetDemoDialog open={isResetOpen} onClose={() => setIsResetOpen(false)} />
    </>
  )
}
