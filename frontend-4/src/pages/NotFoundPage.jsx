import { Compass, Home, MessageSquare, FileText, ArrowLeft, RefreshCw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/common/Button.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

export default function NotFoundPage() {
  useDocumentTitle('404 - Page Not Found')
  const navigate = useNavigate()

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-xl text-center">
        {/* Soft decorative badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Error 404 • Page Not Found</span>
        </div>

        {/* Compass / Medical Icon */}
        <div className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200/60 shadow-soft">
          <Compass className="h-10 w-10 text-emerald-700" strokeWidth={1.75} />
        </div>

        {/* Heading & Friendly Subtitle */}
        <h1 className="mt-6 text-2xl sm:text-3xl font-display font-bold text-navy-950 tracking-tight">
          We couldn’t find this page
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted max-w-md mx-auto leading-relaxed">
          The link you followed may be broken, or the page, report, or section you’re looking for may have moved or been updated.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            to="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 shadow-sm"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>

          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Helpful Quick Links */}
        <div className="mt-10 pt-6 border-t border-ice-200/80">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            Quick Navigation Links
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-brand-700">
            <Link to="/records" className="inline-flex items-center gap-1 hover:text-brand-900 transition-colors">
              <FileText className="h-3.5 w-3.5" />
              My Health Records
            </Link>
            <span className="text-ice-300">•</span>
            <Link to="/copilot" className="inline-flex items-center gap-1 hover:text-brand-900 transition-colors">
              <MessageSquare className="h-3.5 w-3.5" />
              AI Copilot Consultation
            </Link>
            <span className="text-ice-300">•</span>
            <Link to="/medicines" className="inline-flex items-center gap-1 hover:text-brand-900 transition-colors">
              Medicines & Schedule
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
