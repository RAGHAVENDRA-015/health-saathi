import { useEffect } from 'react'

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · HealthSaathi AI` : 'HealthSaathi AI · Personal Health Copilot'
  }, [title])
}
