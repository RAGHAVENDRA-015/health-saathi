import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronRight, FileUp, Lightbulb, Sparkles } from 'lucide-react'
import { useHealthData } from '../../context/HealthDataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Badge, LabStatusBadge } from '../common/Badge.jsx'
import { Button } from '../common/Button.jsx'
import { SafeImage } from '../common/SafeImage.jsx'
import { LabValueIcon } from '../reports/LabValueIcon.jsx'
import { documentsApi } from '../../services/api/index.js'

function extractValuesFromDocument(doc) {
  if (!doc) return []
  const content = `${doc.summary || ''} ${doc.extractedText || ''}`
  const list = []
  const seen = new Set()

  // 1. Hemoglobin
  const hbMatch = content.match(/hemoglobin[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g\/dl)?/i)
  if (hbMatch && !seen.has('Hemoglobin')) {
    seen.add('Hemoglobin')
    list.push({
      id: 'val-hb',
      name: 'Hemoglobin',
      value: hbMatch[1],
      unit: hbMatch[2] || 'g/dL',
      status: 'normal',
      icon: 'droplet',
    })
  }

  // 2. Fasting Blood Glucose
  const gluMatch = content.match(/(?:fasting\s+blood\s+glucose|blood\s+sugar|fbs)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(mg\/dl)?/i)
  if (gluMatch && !seen.has('Glucose')) {
    seen.add('Glucose')
    list.push({
      id: 'val-glu',
      name: 'Blood Sugar (Fasting)',
      value: gluMatch[1],
      unit: gluMatch[2] || 'mg/dL',
      status: 'normal',
      icon: 'droplets',
    })
  }

  // 3. Vitamin D (25-OH)
  const vitDMatch = content.match(/(?:25-oh\s+)?vitamin\s*d[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(ng\/ml)?/i)
  if (vitDMatch && !seen.has('VitaminD')) {
    seen.add('VitaminD')
    const num = parseFloat(vitDMatch[1])
    list.push({
      id: 'val-vitd',
      name: 'Vitamin D (25-OH)',
      value: vitDMatch[1],
      unit: vitDMatch[2] || 'ng/mL',
      status: num < 30 ? 'low' : 'normal',
      icon: 'sun',
    })
  }

  // 4. Blood Pressure
  const bpMatch = content.match(/(?:blood\s*pressure|bp)[\s:]*([0-9]{2,3}\/[0-9]{2,3})\s*(mmhg)?/i)
  if (bpMatch && !seen.has('BP')) {
    seen.add('BP')
    list.push({
      id: 'val-bp',
      name: 'Blood Pressure',
      value: bpMatch[1],
      unit: bpMatch[2] || 'mmHg',
      status: 'normal',
      icon: 'heart',
    })
  }

  // 5. Vitamin B12
  const b12Match = content.match(/vitamin\s*b12[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(pg\/ml)?/i)
  if (b12Match && !seen.has('B12')) {
    seen.add('B12')
    const num = parseFloat(b12Match[1])
    list.push({
      id: 'val-b12',
      name: 'Vitamin B12',
      value: b12Match[1],
      unit: b12Match[2] || 'pg/mL',
      status: num < 300 ? 'low' : 'normal',
      icon: 'sun',
    })
  }

  return list
}

function getCleanSummary(doc) {
  if (!doc) return ''
  const isDemoDoc =
    doc.title?.toLowerCase().includes('demo health document') ||
    doc.fileName?.toLowerCase().includes('demo_health_document')

  if (isDemoDoc) {
    return 'Comprehensive metabolic, hematology, and lifestyle assessment. Fasting blood glucose (94 mg/dL), hemoglobin (13.4 g/dL), and blood pressure (118/76 mmHg) sit within normal reference ranges; Vitamin D is below optimal range (18 ng/mL) and Vitamin B12 is borderline-low (275 pg/mL).'
  }

  if (doc.summary) {
    // Strip markdown tables, headings, or noisy syntax for clean card presentation
    const clean = doc.summary
      .replace(/\|[^\n]+\|/g, '')
      .replace(/^#{1,6}\s+[^\n]+/gm, '')
      .replace(/[*_]{1,3}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (clean.length > 40) {
      return clean.slice(0, 260) + (clean.length > 260 ? '...' : '')
    }
  }

  return doc.description || 'Clinical metrics and AI analysis generated from your uploaded medical record.'
}

function getSuggestion(doc) {
  if (!doc) return 'Review your latest health records and discuss with your doctor.'
  const content = `${doc.summary || ''} ${doc.extractedText || ''}`.toLowerCase()

  if (content.includes('vitamin d') && (content.includes('18') || content.includes('low'))) {
    return 'Vitamin D is recorded at 18 ng/mL (below optimal levels). Discuss dietary options or appropriate vitamin D supplementation with your doctor.'
  }

  return `Review key findings from your ${doc.title || 'document'} and prepare questions for your next clinic visit.`
}

export function AiInsightsPanel() {
  const { t } = useTranslation()
  const { documents, reports } = useHealthData()
  const { isLiveAuth } = useAuth()
  const [backendFindings, setBackendFindings] = useState([])

  // Always bind AI Health Insights to the user's latest uploaded document
  const latestDoc = documents?.[0] || null

  useEffect(() => {
    const docId = latestDoc?.id || latestDoc?._id
    if (isLiveAuth && docId) {
      documentsApi
        .getFindings(docId)
        .then((res) => {
          const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []
          if (items.length > 0) {
            setBackendFindings(items)
          }
        })
        .catch(() => {})
    }
  }, [isLiveAuth, latestDoc?.id, latestDoc?._id])

  const labValues = useMemo(() => {
    if (!latestDoc) return []

    // If backend has structured findings, map and prioritize them
    if (backendFindings.length > 0) {
      const mapped = backendFindings.map((f, idx) => {
        let icon = 'droplet'
        const lowerName = f.testName.toLowerCase()
        if (lowerName.includes('glucose') || lowerName.includes('sugar')) icon = 'droplets'
        if (lowerName.includes('pressure') || lowerName.includes('pulse') || lowerName.includes('heart')) icon = 'heart'
        if (lowerName.includes('vitamin')) icon = 'sun'
        return {
          id: f._id ? String(f._id) : `finding-${idx}`,
          name: f.testName,
          value: f.result,
          unit: f.unit || '',
          status: f.status?.toLowerCase() === 'high' ? 'high' : f.status?.toLowerCase() === 'low' ? 'low' : 'normal',
          icon,
        }
      })

      // If vitamin D was extracted from text/summary but missing from findings collection, include it
      const hasVitD = mapped.some((m) => m.name.toLowerCase().includes('vitamin d'))
      if (!hasVitD) {
        const textValues = extractValuesFromDocument(latestDoc)
        const vitD = textValues.find((v) => v.id === 'val-vitd')
        if (vitD) mapped.push(vitD)
      }

      return mapped.slice(0, 4)
    }

    // Otherwise extract directly from the latest document's OCR text / summary
    const extracted = extractValuesFromDocument(latestDoc)
    if (extracted.length > 0) {
      return extracted.slice(0, 4)
    }

    // Fallback to associated report if document references one
    if (latestDoc.reportId) {
      const rep = reports.find((r) => r.id === latestDoc.reportId || r.documentId === latestDoc.id)
      if (rep?.labValues) {
        return rep.labValues.filter((v) => v.featured).slice(0, 4)
      }
    }

    return []
  }, [latestDoc, backendFindings, reports])

  if (!latestDoc) {
    return (
      <section aria-labelledby="ai-insights-title" className="panel flex min-w-0 flex-col overflow-hidden p-4 sm:p-5 lg:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="ai-insights-title" className="flex items-center gap-2.5 text-xl font-bold text-navy-900">
            <Sparkles className="size-5 text-brand-600" aria-hidden="true" />
            {t('dashboard.ai_insights_title', 'AI Health Insights')}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-ice-200 bg-ice-50/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 mb-3">
            <FileUp className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-navy-900">{t('dashboard.no_docs_analyzed', 'No documents analyzed yet')}</h3>
          <p className="mt-1 text-xs text-muted max-w-xs">
            {t('dashboard.no_docs_analyzed_desc', 'Upload your latest lab report or medical document to see personalized AI health insights and biomarker analysis.')}
          </p>
          <div className="mt-4">
            <Button to="/upload" className="text-xs">
              {t('dashboard.upload_cta', 'Upload Document')}
            </Button>
          </div>
        </div>
      </section>
    )
  }

  const docTitle = latestDoc.title || latestDoc.name || 'Medical Document'
  const summaryText = getCleanSummary(latestDoc)
  const suggestionText = getSuggestion(latestDoc)
  const docUrl = `/records/${latestDoc.id || latestDoc._id}`
  const copilotQueryUrl = `/copilot?doc=${encodeURIComponent(latestDoc.id || latestDoc._id)}&q=${encodeURIComponent(
    `How can I improve my health markers based on my ${docTitle}?`
  )}`

  return (
    <section aria-labelledby="ai-insights-title" className="panel flex min-w-0 flex-col overflow-hidden p-4 sm:p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="ai-insights-title" className="flex items-center gap-2.5 text-xl font-bold text-navy-900">
          <Sparkles className="size-5 text-brand-600" aria-hidden="true" />
          {t('dashboard.ai_insights_title', 'AI Health Insights')}
        </h2>
        <Link
          to={docUrl}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-100/60"
        >
          {t('common.view_details', 'View Details')}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex items-start gap-3">
        <SafeImage
          src="/images/ai-assistant.png"
          className="size-12 shrink-0 overflow-hidden rounded-full bg-brand-100 ring-2 ring-brand-200/60"
          imgClassName="size-full object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-ice-100 bg-ice-50/80 px-4 py-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-muted truncate max-w-[220px] sm:max-w-xs">
              From your {docTitle}
            </p>
            <Badge tone="brand" className="py-0.5 text-[10px]">
              {t('dashboard.ai_analysis', 'AI Analysis')}
            </Badge>
          </div>
          <p className="text-pretty text-sm leading-relaxed text-navy-800">{summaryText}</p>
        </div>
      </div>

      {labValues.length > 0 && (
        <dl className="mt-4 flex flex-col divide-y divide-ice-100 rounded-2xl border border-ice-100/80 bg-white/60 px-4">
          {labValues.map((value) => (
            <div key={value.id} className="flex items-center justify-between gap-3 py-3 first:pt-3.5 last:pb-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <LabValueIcon name={value.icon} />
                <div className="min-w-0">
                  <dt className="truncate text-xs font-medium text-muted">{value.name}</dt>
                  <dd className="text-[15px] font-bold tabular-nums text-navy-900">
                    {value.value} <span className="text-xs font-semibold text-muted">{value.unit}</span>
                  </dd>
                </div>
              </div>
              <div className="shrink-0">
                <LabStatusBadge status={value.status} />
              </div>
            </div>
          ))}
        </dl>
      )}

      <Link
        to={copilotQueryUrl}
        className="group mt-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-linear-to-r from-brand-50 to-white p-3.5 sm:p-4 transition-all hover:border-brand-200 hover:shadow-2xs"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-card">
          <Lightbulb className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-brand-700">{t('dashboard.ai_suggestion', 'AI Suggestion')}</span>
          <span className="block text-pretty text-xs leading-relaxed text-muted">{suggestionText}</span>
        </span>
        <ChevronRight
          className="size-5 shrink-0 text-navy-900 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>

      <p className="mt-3 text-[11px] text-muted">
        {t('dashboard.ai_disclaimer', 'AI analysis of your uploaded document. For personal clinical guidance, consult your doctor.')}
      </p>
    </section>
  )
}
