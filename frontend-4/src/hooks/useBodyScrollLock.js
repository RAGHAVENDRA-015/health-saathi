import { useEffect } from 'react'

let activeLocks = 0
let originalBodyOverflow = ''
let originalBodyOverscroll = ''
let originalHtmlOverflow = ''
let originalHtmlOverscroll = ''
let originalPaddingRight = ''

/**
 * Custom hook to lock body and root viewport scrolling when a modal, drawer, or slide-over is open.
 * Prevents "Background Scroll" (also known as "Scroll Bleed" or "Scroll Chaining").
 * Restores original scroll and overscroll behaviors upon dismissal or unmount.
 *
 * Uses reference counting so nested or sequentially opened modals handle lock state cleanly.
 *
 * @param {boolean} isLocked Whether scroll locking is active.
 */
export function useBodyScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return

    if (activeLocks === 0) {
      originalBodyOverflow = document.body.style.overflow
      originalBodyOverscroll = document.body.style.overscrollBehavior
      originalHtmlOverflow = document.documentElement.style.overflow
      originalHtmlOverscroll = document.documentElement.style.overscrollBehavior
      originalPaddingRight = document.body.style.paddingRight

      // Compensate for layout shift on desktop when scrollbar disappears
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }

      document.body.style.overflow = 'hidden'
      document.body.style.overscrollBehavior = 'none'
      document.documentElement.style.overflow = 'hidden'
      document.documentElement.style.overscrollBehavior = 'none'
    }

    activeLocks += 1

    return () => {
      activeLocks = Math.max(0, activeLocks - 1)
      if (activeLocks === 0) {
        document.body.style.overflow = originalBodyOverflow
        document.body.style.overscrollBehavior = originalBodyOverscroll
        document.documentElement.style.overflow = originalHtmlOverflow
        document.documentElement.style.overscrollBehavior = originalHtmlOverscroll
        document.body.style.paddingRight = originalPaddingRight
      }
    }
  }, [isLocked])
}
