import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from '../utils/cn.js'

const ToastContext = createContext(null)
const TOAST_DURATION_MS = 4500

const toneStyles = {
  success: { icon: CircleCheck, className: 'text-emerald-600' },
  info: { icon: Info, className: 'text-brand-600' },
  error: { icon: CircleAlert, className: 'text-rose-600' },
  danger: { icon: CircleAlert, className: 'text-rose-600' },
  warning: { icon: CircleAlert, className: 'text-amber-600' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const notify = useCallback(
    ({ title, description, tone = 'success' }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts((current) => [...current, { id, title, description, tone }])
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {toasts.map((toast) => {
          const { icon: Icon, className } = toneStyles[toast.tone] ?? toneStyles.info
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-white bg-white p-4 shadow-pop"
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', className)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-sm text-muted">{toast.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-full p-1 text-muted hover:bg-ice-100 hover:text-navy-900"
              >
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Dismiss notification</span>
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
