import { useEffect, useState } from 'react'
import { storageService } from '../services/storageService.js'

export function usePersistentState(key, initialValue, validate) {
  const [value, setValue] = useState(() => storageService.get(key, initialValue, validate))

  useEffect(() => {
    storageService.set(key, value)
  }, [key, value])

  return [value, setValue]
}
