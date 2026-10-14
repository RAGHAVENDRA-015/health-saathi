import { useCallback, useId, useRef, useState } from 'react'
import { useClickOutside } from '../../hooks/useClickOutside.js'
import { cn } from '../../utils/cn.js'

export function Dropdown({ renderTrigger, children, align = 'end', panelClassName }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const panelId = useId()

  const close = useCallback(() => setOpen(false), [])
  useClickOutside(containerRef, close, open)

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          containerRef.current?.querySelector('[data-dropdown-trigger]')?.focus()
        }
      }}
    >
      {renderTrigger({
        open,
        triggerProps: {
          'data-dropdown-trigger': true,
          'aria-expanded': open,
          'aria-controls': panelId,
          onClick: () => setOpen((value) => !value),
        },
      })}
      {open && (
        <div
          id={panelId}
          className={cn(
            'absolute top-full z-40 mt-2 rounded-2xl border border-ice-200 bg-white p-2 shadow-pop',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children({ close })}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({ as: Component = 'button', icon: Icon, tone = 'default', className, children, ...props }) {
  return (
    <Component
      {...(Component === 'button' ? { type: 'button' } : {})}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
        tone === 'danger' ? 'text-rose-600 hover:bg-rose-50' : 'text-navy-900 hover:bg-ice-100',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="size-4 shrink-0 opacity-80" aria-hidden="true" />}
      {children}
    </Component>
  )
}
