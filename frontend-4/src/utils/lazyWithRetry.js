import { lazy } from 'react'

/**
 * Wraps React.lazy with automatic retry and reload resilience.
 * When Vite re-bundles or dev server restarts, chunks or dynamic imports can 404
 * with 'Failed to fetch dynamically imported module'.
 *
 * This utility catches such transient errors, reloads the page once to pull the
 * latest HTML/JS manifest, and avoids showing raw developer error traces to the user.
 */
export function lazyWithRetry(componentImport, key = 'hs_lazy_reload') {
  return lazy(async () => {
    const hasReloaded = window.sessionStorage.getItem(key) === 'true'
    try {
      const component = await componentImport()
      window.sessionStorage.removeItem(key)
      return component
    } catch (error) {
      const errorMessage = String(error?.message || '')
      const isDynamicImportError =
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('error loading dynamically imported module') ||
        errorMessage.includes('Loading chunk') ||
        error?.name === 'TypeError'

      if (isDynamicImportError && !hasReloaded) {
        window.sessionStorage.setItem(key, 'true')
        window.location.reload()
        return new Promise(() => {}) // Suspend until browser reload completes
      }

      // Re-throw if already reloaded or for non-module errors so ErrorBoundary handles it
      throw error
    }
  })
}
