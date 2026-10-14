const NAMESPACE = 'healthsaathi:v1:'

function getStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export const storageService = {
  get(key, fallback, validate) {
    const storage = getStorage()
    if (!storage) return fallback
    try {
      const raw = storage.getItem(NAMESPACE + key)
      if (raw === null) return fallback
      const parsed = JSON.parse(raw)
      if (validate && !validate(parsed)) return fallback
      return parsed
    } catch {
      return fallback
    }
  },

  set(key, value) {
    const storage = getStorage()
    if (!storage) return
    try {
      storage.setItem(NAMESPACE + key, JSON.stringify(value))
    } catch {
      // Storage can be full or blocked (e.g. private mode); the in-memory state still works.
    }
  },

  remove(key) {
    const storage = getStorage()
    if (!storage) return
    try {
      storage.removeItem(NAMESPACE + key)
    } catch {
      // Ignore errors in restricted storage environments
    }
  },

  clearAll() {
    const storage = getStorage()
    if (!storage) return
    Object.keys(storage)
      .filter((key) => key.startsWith(NAMESPACE))
      .forEach((key) => storage.removeItem(key))
  },
}
