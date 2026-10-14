import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp, SearchX, Search } from 'lucide-react'
import { Button } from '../components/common/Button.jsx'
import { EmptyState } from '../components/common/EmptyState.jsx'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { DocumentList } from '../components/records/DocumentList.jsx'
import { useHealthData } from '../context/HealthDataContext.jsx'
import { DOCUMENT_CATEGORIES } from '../data/mockDocuments.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { cn } from '../utils/cn.js'
import { getDocumentCategory } from '../utils/documents.js'

const tabs = [{ id: 'all', label: 'All' }, ...Object.entries(DOCUMENT_CATEGORIES).map(([id, { label }]) => ({ id, label }))]

export default function RecordsPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('records.title', 'My Records'))
  const { documents, stats } = useHealthData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sortOrder, setSortOrder] = useState('newest')
  const category = tabs.some((tab) => tab.id === searchParams.get('category')) ? searchParams.get('category') : 'all'
  const query = searchParams.get('q') ?? ''

  const updateParam = (key, value, defaultValue) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === defaultValue) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = documents.filter(
    (doc) =>
      (category === 'all' || getDocumentCategory(doc.type) === category) &&
      (!normalizedQuery ||
        [doc.title, doc.description, doc.provider].some((field) => field?.toLowerCase().includes(normalizedQuery))),
  )

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortOrder === 'name') return a.title.localeCompare(b.title)
    if (sortOrder === 'oldest') return a.date.localeCompare(b.date)
    return b.date.localeCompare(a.date)
  })

  const countFor = (id) => (id === 'all' ? stats.total.count : stats[id].count)

  const categoryLabels = {
    all: t('records.all_types', 'All'),
    lab: t('records.lab_reports', 'Lab Reports'),
    prescription: t('records.prescriptions', 'Prescriptions'),
    scan: t('records.scans', 'Scans & Imaging'),
    discharge: t('records.discharge_summaries', 'Discharge Summaries'),
    other: t('records.other', 'Other Documents'),
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t('records.eyebrow', 'My Records')}
        title={t('records.title', 'All medical records')}
        description={t('records.description', 'Every report, prescription and scan you have added, newest first.')}
        actions={
          <Button to="/upload">
            <FileUp aria-hidden="true" />
            {t('dashboard.upload_cta', 'Upload Document')}
          </Button>
        }
      />

      <section className="panel flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Filter records by category" className="flex gap-1 overflow-x-auto rounded-full bg-ice-50 p-1">
            {tabs.map((tab) => {
              const selected = tab.id === category
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => updateParam('category', tab.id, 'all')}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                    selected ? 'bg-white text-navy-900 shadow-card' : 'text-muted hover:text-navy-900',
                  )}
                >
                  {categoryLabels[tab.id] || tab.label}
                  <span className="rounded-full bg-ice-100 px-2 text-xs tabular-nums">{countFor(tab.id)}</span>
                </button>
              )
            })}
          </div>
          <label className="block sm:w-44">
            <span className="sr-only">{t('records.sort_records', 'Sort records')}</span>
            <select aria-label={t('records.sort_records', 'Sort records')} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="field">
              <option value="newest">{t('records.sort_newest', 'Newest first')}</option>
              <option value="oldest">{t('records.sort_oldest', 'Oldest first')}</option>
              <option value="name">{t('records.sort_name', 'Name A–Z')}</option>
            </select>
          </label>
          <label className="relative block lg:w-72">
            <span className="sr-only">Filter records</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => updateParam('q', event.target.value, '')}
              placeholder={t('records.search_placeholder', 'Filter by name, doctor or lab')}
              className="field pl-10"
            />
          </label>
        </div>

        {filtered.length > 0 ? (
          <DocumentList documents={sortedFiltered} caption="Medical records" />
        ) : (
          <EmptyState
            icon={SearchX}
            title={documents.length ? t('records.no_matching', 'No matching records') : t('records.no_records_title', 'No records yet')}
            description={
              documents.length ? t('records.no_matching_desc', 'Try a different category or search term.') : t('records.no_records_desc', 'Upload your first document to start building your health history.')
            }
            action={
              documents.length ? (
                <Button variant="secondary" onClick={() => setSearchParams({}, { replace: true })}>
                  {t('records.clear_filters', 'Clear filters')}
                </Button>
              ) : (
                <Button to="/upload">{t('dashboard.upload_cta', 'Upload Document')}</Button>
              )
            }
          />
        )}
      </section>
    </div>
  )
}
