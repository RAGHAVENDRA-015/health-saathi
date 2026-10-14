import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useHealthData } from '../../context/HealthDataContext.jsx'
import { cn } from '../../utils/cn.js'
import { Dropdown } from '../common/Dropdown.jsx'

export function NotificationsMenu() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useHealthData()

  return (
    <Dropdown
      panelClassName="w-[min(88vw,22rem)]"
      renderTrigger={({ triggerProps }) => (
        <button
          type="button"
          {...triggerProps}
          className="glass relative grid size-11 place-items-center rounded-2xl text-navy-900 hover:bg-white"
        >
          <Bell className="size-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-accent-500 ring-2 ring-white"
            />
          )}
          <span className="sr-only">
            Notifications{unreadCount > 0 ? `, ${unreadCount} unread` : ''}
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex items-center justify-between px-3 pt-2 pb-3">
            <p className="text-sm font-bold text-navy-900">Notifications</p>
            <button
              type="button"
              onClick={markAllNotificationsRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100/60 disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all read
            </button>
          </div>
          <ul className="flex flex-col gap-0.5">
            {notifications.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to}
                  onClick={() => {
                    markNotificationRead(item.id)
                    close()
                  }}
                  className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-ice-50"
                >
                  <span
                    aria-hidden="true"
                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.read ? 'bg-ice-300' : 'bg-accent-500')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm text-navy-900', item.read ? 'font-medium' : 'font-bold')}>
                      {item.title}
                      {!item.read && <span className="sr-only"> (unread)</span>}
                    </span>
                    <span className="block text-xs text-muted">{item.description}</span>
                    <span className="mt-1 block text-[11px] text-muted/80">{item.time}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dropdown>
  )
}
