import { Component, useState } from 'react'
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import { AlertCircle, RefreshCw, Home, ShieldAlert, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { Button } from './Button.jsx'
import NotFoundPage from '../../pages/NotFoundPage.jsx'

/**
 * Friendly Error Screen presented whenever a page, chunk, or endpoint encounters an error.
 */
export function ErrorFallbackView({ error, onReset }) {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  const errorMessage = String(error?.message || error?.statusText || 'An unexpected application condition occurred.')
  const isDynamicImport =
    errorMessage.includes('dynamically imported module') ||
    errorMessage.includes('Failed to fetch dynamically imported module') ||
    errorMessage.includes('Loading chunk') ||
    errorMessage.includes('error loading')

  const handleCopy = () => {
    const textToCopy = `Error: ${errorMessage}\nStack: ${error?.stack || 'N/A'}\nURL: ${window.location.href}\nTime: ${new Date().toISOString()}`
    navigator.clipboard?.writeText?.(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleReload = () => {
    if (onReset) onReset()
    window.location.reload()
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg rounded-2xl border border-ice-200/90 bg-white p-6 sm:p-8 shadow-card text-center">
        {/* Soft Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>{isDynamicImport ? 'Application Update' : 'Temporary Page Notice'}</span>
        </div>

        {/* Icon */}
        <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 text-amber-600 shadow-2xs">
          {isDynamicImport ? (
            <RefreshCw className="h-8 w-8 text-brand-600 animate-spin-once" />
          ) : (
            <ShieldAlert className="h-8 w-8 text-amber-600" />
          )}
        </div>

        {/* Title & Description */}
        <h2 className="mt-5 text-xl sm:text-2xl font-display font-bold text-navy-950">
          {isDynamicImport ? 'A quick reload is needed' : 'Something didn’t load quite right'}
        </h2>

        <p className="mt-2.5 text-xs sm:text-sm text-muted leading-relaxed max-w-md mx-auto">
          {isDynamicImport
            ? 'A fresh update of HealthSaathi is ready, or your network momentarily paused while loading this section. Refreshing the page will load it smoothly.'
            : 'We ran into an unexpected hiccup loading this view. Your health records, medicines, and profile are completely safe and unchanged.'}
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={handleReload}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </Button>

          <Button
            to="/dashboard"
            variant="secondary"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>

        {/* Optional Collapsible Diagnostic */}
        <div className="mt-8 pt-5 border-t border-ice-100 text-left">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-navy-900 transition-colors"
          >
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>Technical details</span>
          </button>

          {showDetails && (
            <div className="mt-2 rounded-lg bg-ice-50 p-3 text-[11px] font-mono text-navy-800 border border-ice-200/60 relative">
              <div className="flex justify-between items-start gap-2 mb-1">
                <span className="font-semibold text-muted uppercase text-[10px]">Reference</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[10px] text-brand-700 hover:text-brand-900"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="break-all line-clamp-3">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Root Router Error Boundary for React Router 7 / createBrowserRouter.
 * Intercepts route crashes, missing chunks, and 404s before React Router's
 * default debug screen triggers.
 */
export function RootErrorBoundary() {
  const error = useRouteError()

  // Handle standard HTTP responses (404, 401, 500)
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />
    }

    if (error.status === 401) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-ice-200 bg-white p-6 sm:p-8 text-center shadow-card">
            <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-4 text-xl font-bold text-navy-950">Session Expired</h2>
            <p className="mt-2 text-sm text-muted">
              For your medical privacy and security, your session has timed out. Please log in again to continue.
            </p>
            <div className="mt-6">
              <Button to="/login" className="w-full">
                Log In Again
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (error.status === 403) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-ice-200 bg-white p-6 sm:p-8 text-center shadow-card">
            <ShieldAlert className="mx-auto h-12 w-12 text-rose-500" />
            <h2 className="mt-4 text-xl font-bold text-navy-950">Access Restricted</h2>
            <p className="mt-2 text-sm text-muted">
              You do not have permission to view this section of health records.
            </p>
            <div className="mt-6">
              <Button to="/dashboard" className="w-full">
                Return to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )
    }
  }

  // Handle Javascript runtime errors and Vite chunk import failures
  return <ErrorFallbackView error={error} />
}

/**
 * Standard React Class Error Boundary for wrapping non-router component trees.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[HealthSaathi ErrorBoundary] Caught error:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.resetError })
      }
      return <ErrorFallbackView error={this.state.error} onReset={this.resetError} />
    }
    return this.props.children
  }
}
