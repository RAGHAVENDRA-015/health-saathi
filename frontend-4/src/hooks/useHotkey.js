import { useEffect, useEffectEvent } from 'react'

export function useModifierHotkey(key, onPress) {
  const handlePress = useEffectEvent(onPress)

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === key) {
        event.preventDefault()
        handlePress(event)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key])
}
