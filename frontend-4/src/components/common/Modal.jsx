import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js'
import { cn } from '../../utils/cn.js'

const variants = {
  center: 'm-auto w-[min(92vw,34rem)] max-h-[90dvh] rounded-3xl',
  drawer: 'my-0 ml-0 mr-auto h-dvh max-h-dvh w-[min(86vw,20rem)] max-w-none rounded-r-3xl',
}

export function Modal({ open, onClose, title, description, variant = 'center', hideHeader = false, children }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useBodyScrollLock(open)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn('overflow-hidden border-0 bg-white p-0 text-navy-900 shadow-pop overscroll-contain', variants[variant])}
    >
      <div className="flex h-full max-h-[inherit] flex-col overscroll-contain">
        <div className={cn('flex items-start justify-between gap-4 px-6 pt-6', hideHeader && 'sr-only')}>
          <div>
            <h2 id={titleId} className="text-lg font-bold text-navy-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-muted">
                {description}
              </p>
            )}
          </div>
          {!hideHeader && (
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-2 rounded-full p-2 text-muted hover:bg-ice-100 hover:text-navy-900"
            >
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{open && children}</div>
      </div>
    </dialog>
  )
}
