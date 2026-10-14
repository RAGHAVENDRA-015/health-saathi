import { useEffect, useEffectEvent } from 'react'

export function useClickOutside(ref, onOutside, enabled = true) {
  const handleOutside = useEffectEvent(onOutside)

  useEffect(() => {
    if (!enabled) return
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handleOutside(event)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [ref, enabled])
}
