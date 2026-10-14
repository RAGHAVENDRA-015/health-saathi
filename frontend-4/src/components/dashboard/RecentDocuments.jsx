import { Link } from 'react-router-dom'
import { ArrowRight, FileUp, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHealthData } from '../../context/HealthDataContext.jsx'
import { Button } from '../common/Button.jsx'
import { EmptyState } from '../common/EmptyState.jsx'
import { DocumentList } from '../records/DocumentList.jsx'

const RECENT_LIMIT = 4

export function RecentDocuments() {
  const { t } = useTranslation()
  const { documents } = useHealthData()
  const recent = documents.slice(0, RECENT_LIMIT)

  return (
    <section aria-labelledby="recent-documents-title" className="panel flex min-w-0 flex-col overflow-hidden p-4 sm:p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="recent-documents-title" className="text-xl font-bold text-navy-900">
          {t('dashboard.recent_records', 'Recent Documents')}
        </h2>
        <Link
          to="/records"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-100/60"
        >
          {t('dashboard.view_all', 'View All')}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {recent.length > 0 ? (
        <DocumentList documents={recent} caption="Most recent medical documents" compact />
      ) : (
        <EmptyState
          icon={FolderOpen}
          title={t('records.no_records_title', 'No documents yet')}
          description={t('records.no_records_desc', 'Upload your first lab report, prescription or scan to get started.')}
          action={
            <Button to="/upload">
              <FileUp aria-hidden="true" />
              {t('dashboard.upload_cta', 'Upload Document')}
            </Button>
          }
        />
      )}
    </section>
  )
}
