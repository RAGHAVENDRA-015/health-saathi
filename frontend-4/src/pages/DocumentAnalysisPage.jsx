import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, CheckCircle2, Download, FileImage, FileQuestion, FileText, Info,
  Sparkles, Trash2,
} from 'lucide-react'
import { Badge, LabStatusBadge, StatusBadge, TypeBadge } from '../components/common/Badge.jsx'
import { Button } from '../components/common/Button.jsx'
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx'
import { DocumentIcon } from '../components/common/DocumentIcon.jsx'
import { EmptyState } from '../components/common/EmptyState.jsx'
import { SafeImage } from '../components/common/SafeImage.jsx'
import { useHealthData } from '../context/HealthDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { documentsApi } from '../services/api/index.js'
import { useToast } from '../context/ToastContext.jsx'
import { ClinicalMarkdownRenderer } from '../components/common/ClinicalMarkdownRenderer.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { cn } from '../utils/cn.js'
import { formatDate } from '../utils/documents.js'

export default function DocumentAnalysisPage() {
  const { t } = useTranslation()
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { documents, reports, removeDocument, getLocalFile } = useHealthData()
  const { isLiveAuth } = useAuth()
  const { notify } = useToast()
  const [activeTab, setActiveTab] = useState('summary')
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [backendFindings, setBackendFindings] = useState([])

  const document = documents.find((doc) => doc.id === documentId)
  const report = document?.reportId ? reports.find((item) => item.id === document.reportId) : null
  const file = getLocalFile(documentId)

  useEffect(() => {
    if (isLiveAuth && documentId) {
      documentsApi.getFindings(documentId)
        .then((res) => {
          if (Array.isArray(res)) setBackendFindings(res)
        })
        .catch(() => {})
    }
  }, [isLiveAuth, documentId])
  useDocumentTitle(document?.title ?? 'Record not found')

  if (!document) {
    return (
      <div className="panel">
        <EmptyState
          icon={FileQuestion}
          title="Record not found"
          description="This record may have been removed or the link is incorrect."
          action={<Button to="/records">Back to My Records</Button>}
        />
      </div>
    )
  }

  const details = [
    ['Type', <TypeBadge key="type" type={document.type} />],
    ['Report date', formatDate(document.date)],
    ['Doctor or lab', document.provider || '—'],
    ['File name', document.fileName || '—'],
    ['Status', <StatusBadge key="status" status={document.status} />],
  ]

  const tabs = [
    { id: 'summary', label: t('dashboard.ai_analysis', 'AI Summary') },
  ]

  return (
    <div className="flex flex-col gap-5">
      <Link to="/records" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('records.eyebrow', 'My Records')}
      </Link>

      <header className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <DocumentIcon type={document.type} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 text-balance">{document.title}</h1>
              <Badge tone="neutral">Health record</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{document.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {file && <Button variant="secondary" onClick={() => downloadFile(file)}><Download aria-hidden="true" /> Download original</Button>}
          <Button to={`/copilot?q=${encodeURIComponent(`Explain my ${document.title}`)}&doc=${encodeURIComponent(document.id || document._id)}`} variant="navy">
            <Sparkles aria-hidden="true" /> {t('records.ask_copilot', 'Ask AI Copilot')}
          </Button>
          <Button variant="secondary" onClick={() => setIsConfirmOpen(true)}>
            <Trash2 aria-hidden="true" /> {t('records.remove_record', 'Remove')}
          </Button>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-5">
          <LocalFilePreview file={file} title={document.title} fileName={document.fileName} />
          <section className="panel p-5 sm:p-6">
            <h2 className="text-base font-extrabold text-navy-900">{t('records.document_details', 'Document details')}</h2>
            <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs font-semibold text-muted">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-navy-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section className="panel min-w-0 p-3 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><Sparkles className="size-5 text-brand-600" /><h2 className="text-lg font-extrabold text-navy-900">Report workspace</h2></div>
              <p className="mt-1 text-sm text-muted">Review clinical insights and AI analysis for this record.</p>
            </div>
          </div>
          <div role="tablist" aria-label="Document analysis sections" className="mt-5 flex gap-1 overflow-x-auto rounded-full bg-ice-50 p-1 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
                  activeTab === tab.id ? 'bg-white text-navy-900 shadow-card' : 'text-muted hover:text-navy-900',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'summary' && (
            <div id="panel-summary" role="tabpanel" aria-labelledby="tab-summary" className="pt-4 sm:pt-5">
              {report ? (
                <>
                  <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-3 sm:p-5 shadow-2xs">
                    <div className="flex items-center gap-2.5 border-b border-brand-200/60 pb-2.5 mb-3">
                      <span className="grid size-8 sm:size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-2xs">
                        <SafeImage src="/images/ai-assistant.png" alt="" className="size-7 sm:size-9 overflow-hidden rounded-lg" imgClassName="size-full object-cover" />
                      </span>
                      <p className="text-sm font-extrabold text-navy-900">Sample report summary</p>
                    </div>
                    <div className="w-full min-w-0">
                      <ClinicalMarkdownRenderer content={report.summary} />
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" /><h3 className="text-sm font-extrabold text-navy-900">Key values</h3></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {report.labValues.filter((item) => item.featured).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 rounded-2xl border border-ice-200 bg-white/80 p-3">
                        <div className="min-w-0"><p className="truncate text-xs text-muted">{item.name}</p><p className="mt-1 text-sm font-extrabold text-navy-900">{item.value} {item.unit}</p></div><LabStatusBadge status={item.status} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5"><p className="flex items-start gap-2 text-xs leading-5 text-amber-900"><Info className="mt-0.5 size-4 shrink-0" />This is a static sample summary, not analysis of the selected upload and not medical advice.</p></div>
                </>
              ) : document.summary ? (
                <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-3 sm:p-5 shadow-2xs">
                  <div className="flex items-center gap-2.5 border-b border-brand-200/60 pb-2.5 mb-3">
                    <span className="grid size-8 sm:size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-2xs">
                      <SafeImage src="/images/ai-assistant.png" alt="" className="size-7 sm:size-9 overflow-hidden rounded-lg" imgClassName="size-full object-cover" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-navy-900">Document AI Summary</p>
                      <Badge tone="brand">AI Analysis</Badge>
                    </div>
                  </div>
                  <div className="w-full min-w-0">
                    <ClinicalMarkdownRenderer content={document.summary} />
                  </div>
                </div>
              ) : (
                <EmptyState icon={Sparkles} title="Processing or metadata only" description="AI summary will be generated once document OCR completes." action={<Button to={`/copilot?q=${encodeURIComponent(`What can I review in ${document.title}?`)}&doc=${encodeURIComponent(document.id || document._id)}`} variant="secondary">Ask Copilot about this record</Button>} />
              )}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Remove this record?"
        description={`“${document.title}” will be removed from your records on this device.`}
        confirmLabel="Remove record"
        onConfirm={() => {
          removeDocument(document.id)
          notify({ title: 'Record removed', description: document.title, tone: 'info' })
          navigate('/records')
        }}
      />
    </div>
  )
}

function downloadFile(file) {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name || 'healthsaathi-document'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function LocalFilePreview({ file, title, fileName }) {
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <section className="panel overflow-hidden p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-base font-extrabold text-navy-900">Document preview</h2><Badge tone={file ? 'success' : 'neutral'}>{file ? 'This session' : 'Sample / metadata'}</Badge></div>
      <div className="mt-4 flex min-h-[320px] items-center justify-center overflow-hidden rounded-2xl border border-ice-200 bg-[linear-gradient(140deg,#f7fbff,#e9f5ff)] sm:min-h-[440px]">
        {file && previewUrl && file.type === 'application/pdf' ? (
          <iframe title={`PDF preview: ${title}`} src={previewUrl} className="h-[440px] w-full border-0 sm:h-[560px]" />
        ) : file && previewUrl && file.type.startsWith('image/') ? (
          <img src={previewUrl} alt={`Uploaded document: ${title}`} className="max-h-[560px] w-full object-contain" />
        ) : (
          <div className="max-w-sm p-6 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-white bg-white/90 text-brand-600 shadow-card"><FileImage className="size-7" /></span>
            <p className="mt-4 text-sm font-extrabold text-navy-900">{fileName || 'Sample document'}</p>
            <p className="mt-2 text-xs leading-5 text-muted">The original file is not bundled with this sample record. Upload a PDF or image to preview the actual file during this session.</p>
            <p className="mt-3 text-[10px] leading-4 text-muted">Illustrative placeholder — not the original medical document.</p>
          </div>
        )}
      </div>
      {file && <p className="mt-3 break-words text-xs text-muted">{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB · preview is temporary and remains available only during this browser session.</p>}
    </section>
  )
}

export function LabValuesTable({ values }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">Laboratory values</caption>
        <thead className="text-xs text-muted"><tr className="border-b border-ice-100"><th scope="col" className="py-2.5 pr-4 font-semibold">Test</th><th scope="col" className="py-2.5 pr-4 font-semibold">Result</th><th scope="col" className="py-2.5 pr-4 font-semibold">Reference range</th><th scope="col" className="py-2.5 font-semibold">Status</th></tr></thead>
        <tbody>{values.map((value) => <tr key={value.id} className="border-b border-ice-100 last:border-0"><th scope="row" className="py-3 pr-4 font-semibold text-navy-900">{value.name}</th><td className="py-3 pr-4 tabular-nums text-navy-800">{value.value} {value.unit}</td><td className="py-3 pr-4 tabular-nums text-muted">{value.range} {value.unit}</td><td className="py-3"><LabStatusBadge status={value.status} /></td></tr>)}</tbody>
      </table>
    </div>
  )
}
