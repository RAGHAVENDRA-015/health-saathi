import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity, ArrowDownUp, BarChart3, CalendarDays, Download, ExternalLink,
  FileText, FlaskConical, HeartPulse, Info, Lightbulb, Search, TrendingDown,
  TrendingUp, X,
} from 'lucide-react'
import { Badge, LabStatusBadge } from '../components/common/Badge.jsx'
import { Button } from '../components/common/Button.jsx'
import { EmptyState } from '../components/common/EmptyState.jsx'
import { Modal } from '../components/common/Modal.jsx'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { SafeImage } from '../components/common/SafeImage.jsx'
import { useHealthData } from '../context/HealthDataContext.jsx'
import { LAB_STATUSES, organFocusAreas, deriveLabStatus } from '../data/mockReports.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { cn } from '../utils/cn.js'
import { formatDate } from '../utils/documents.js'
import { LabValueIcon } from '../components/reports/LabValueIcon.jsx'

const categories = [
  { id: 'all', label: 'All results' },
  { id: 'blood', label: 'Blood tests' },
  { id: 'urine', label: 'Urine tests' },
  { id: 'imaging', label: 'Imaging' },
  { id: 'other', label: 'Other' },
]

const categoryLabels = {
  blood: 'Blood test',
  urine: 'Urine test',
  imaging: 'Imaging',
  other: 'Other report',
}

function formatValue(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
  return value ?? '—'
}

function makeCsv(rows) {
  const headers = ['Date', 'Report', 'Category', 'Test', 'Result', 'Unit', 'Reference range', 'Status']
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const lines = [headers, ...rows.map((row) => [row.date, row.reportTitle, categoryLabels[row.category], row.name, row.value, row.unit, row.range, row.statusLabel])]
  return lines.map((line) => line.map(escape).join(',')).join('\r\n')
}

function TrendChart({ series, selectedName, onSelect }) {
  const availableSeries = series
  const active = availableSeries.find((item) => item.name === selectedName) ?? availableSeries[0]
  if (!active) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-ice-200 bg-ice-50/70 p-5 text-center">
        <BarChart3 className="size-8 text-brand-600" aria-hidden="true" />
        <h3 className="mt-3 font-bold text-navy-900">Not enough history to chart</h3>
        <p className="mt-1 max-w-sm text-sm leading-5 text-muted">A trend appears when at least two results use the same test name and unit.</p>
      </div>
    )
  }

  const points = [...active.points].sort((a, b) => a.date.localeCompare(b.date))
  const [selectedPointIndex, setSelectedPointIndex] = useState(points.length - 1)
  const currentPoint = points[selectedPointIndex] ?? points[points.length - 1]

  const width = 640
  const height = 240
  const pad = { top: 24, right: 28, bottom: 48, left: 52 }
  const chartWidth = width - pad.left - pad.right
  const chartHeight = height - pad.top - pad.bottom
  const values = points.map((point) => point.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const padding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.12, 1) : (rawMax - rawMin) * 0.2
  const min = rawMin - padding
  const max = rawMax + padding
  const x = (index) => pad.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth)
  const y = (value) => pad.top + ((max - value) / (max - min)) * chartHeight

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.value)}`).join(' ')
  const areaPath = `${path} L ${x(points.length - 1)} ${height - pad.bottom} L ${x(0)} ${height - pad.bottom} Z`
  const ticks = Array.from({ length: 4 }, (_, index) => max - ((max - min) * index) / 3)

  const latestVal = points[points.length - 1].value
  const prevVal = points.length > 1 ? points[points.length - 2].value : null
  const trendDiff = prevVal !== null ? Number((latestVal - prevVal).toFixed(2)) : null

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-navy-900 text-base">Result trends</h3>
            <span className="rounded-full bg-brand-50 border border-brand-200 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              {points.length} Tests
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-5 text-muted">Historical sample values with matching units.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-navy-800">
          <span className="sr-only">Select test for trend</span>
          <select
            className="field h-10 w-full sm:w-auto sm:max-w-60 text-xs sm:text-sm font-semibold"
            value={active.name}
            onChange={(event) => {
              onSelect(event.target.value)
              setSelectedPointIndex(0)
            }}
          >
            {availableSeries.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} ({item.unit})
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Mobile KPI Summary Strip */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-ice-200 bg-white/80 p-2.5 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Inspected Value</p>
          <p className="mt-0.5 text-base font-extrabold text-brand-700 tabular-nums">
            {formatValue(currentPoint.value)} <span className="text-[11px] font-medium text-navy-800">{active.unit}</span>
          </p>
          <p className="text-[10px] text-muted truncate">{formatDate(currentPoint.date)}</p>
        </div>
        <div className="rounded-xl border border-ice-200 bg-white/80 p-2.5 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Latest Reading</p>
          <p className="mt-0.5 text-base font-extrabold text-navy-900 tabular-nums">
            {formatValue(latestVal)} <span className="text-[11px] font-medium text-navy-800">{active.unit}</span>
          </p>
          <p className="text-[10px] text-muted truncate">{formatDate(points[points.length - 1].date)}</p>
        </div>
        <div className="rounded-xl border border-ice-200 bg-white/80 p-2.5 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Historic Range</p>
          <p className="mt-0.5 text-base font-extrabold text-navy-900 tabular-nums">
            {formatValue(rawMin)} – {formatValue(rawMax)}
          </p>
          <p className="text-[10px] text-muted truncate">Min – Max span</p>
        </div>
        <div className="rounded-xl border border-ice-200 bg-white/80 p-2.5 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Recent Delta</p>
          <div className="mt-0.5 flex items-center gap-1">
            {trendDiff !== null && trendDiff > 0 ? (
              <span className="inline-flex items-center text-xs font-bold text-rose-600">
                <TrendingUp className="size-3.5 mr-0.5" /> +{trendDiff}
              </span>
            ) : trendDiff !== null && trendDiff < 0 ? (
              <span className="inline-flex items-center text-xs font-bold text-emerald-600">
                <TrendingDown className="size-3.5 mr-0.5" /> {trendDiff}
              </span>
            ) : (
              <span className="text-xs font-bold text-muted">Stable</span>
            )}
          </div>
          <p className="text-[10px] text-muted truncate">vs previous</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ice-200 bg-white/85 p-2 sm:p-3 shadow-xs">
        <div className="flex sm:hidden items-center justify-between px-2 pb-1 text-[11px] font-medium text-brand-700">
          <span>Tap data points to inspect values</span>
          <span>↔ Scroll chart</span>
        </div>

        <div className="w-full overflow-x-auto touch-pan-x">
          <div className="min-w-[480px] sm:min-w-full">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${active.name} trend in ${active.unit}`}
              className="block w-full select-none"
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Grid lines and ticks */}
              {ticks.map((tick, index) => (
                <g key={index}>
                  <line
                    x1={pad.left}
                    y1={y(tick)}
                    x2={width - pad.right}
                    y2={y(tick)}
                    stroke="#e1edf8"
                    strokeDasharray="4 5"
                  />
                  <text
                    x={pad.left - 10}
                    y={y(tick) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="500"
                    fill="#627a9b"
                  >
                    {Number(tick.toFixed(2)).toString()}
                  </text>
                </g>
              ))}

              {/* Area gradient under line */}
              <path d={areaPath} fill="url(#trendGradient)" />

              {/* Trend connecting line */}
              <path
                d={path}
                fill="none"
                stroke="#0284c7"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {points.map((point, index) => {
                const isSelected = selectedPointIndex === index
                const px = x(index)
                const py = y(point.value)

                return (
                  <g
                    key={`${point.date}-${index}`}
                    onClick={() => setSelectedPointIndex(index)}
                    className="cursor-pointer transition-transform"
                  >
                    {/* Generous touch target */}
                    <circle cx={px} cy={py} r="18" fill="transparent" />

                    {isSelected && (
                      <circle
                        cx={px}
                        cy={py}
                        r="10"
                        fill="#0284c7"
                        fillOpacity="0.2"
                        className="animate-ping"
                      />
                    )}

                    <circle
                      cx={px}
                      cy={py}
                      r={isSelected ? '7' : '5.5'}
                      fill="#ffffff"
                      stroke={isSelected ? '#0369a1' : '#0284c7'}
                      strokeWidth={isSelected ? '4' : '3'}
                    />

                    {/* Value label */}
                    <text
                      x={px}
                      y={py - 12}
                      textAnchor="middle"
                      fontSize={isSelected ? '12' : '11'}
                      fontWeight="800"
                      fill={isSelected ? '#0369a1' : '#0a2a5e'}
                    >
                      {formatValue(point.value)}
                    </text>

                    {/* Date label */}
                    <text
                      x={px}
                      y={height - 20}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={isSelected ? '700' : '500'}
                      fill={isSelected ? '#0369a1' : '#627a9b'}
                    >
                      {formatDate(point.date)}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ice-100 px-3 pt-2 pb-0.5 text-xs text-muted">
          <span>{points.length} sample measurements</span>
          <span>Measurement Unit: <strong className="text-navy-900">{active.unit || 'Not specified'}</strong></span>
        </div>
      </div>
    </div>
  )
}

function ResultDetail({ result }) {
  if (!result) return null
  return (
    <div className="space-y-5 px-5 pb-6 pt-4 sm:px-6">
      <div className="flex items-start gap-3 rounded-2xl bg-ice-50 p-4">
        <LabValueIcon name={result.icon} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sample result</p>
          <p className="mt-1 break-words text-2xl font-extrabold tracking-tight text-navy-900">{formatValue(result.value)} {result.unit}</p>
          <div className="mt-2"><LabStatusBadge status={result.status} /></div>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold text-muted">Reference range</dt><dd className="mt-1 text-sm font-bold text-navy-900">{result.range || 'Not provided'} {result.range && typeof result.value === 'number' ? result.unit : ''}</dd></div>
        <div><dt className="text-xs font-semibold text-muted">Report date</dt><dd className="mt-1 text-sm font-bold text-navy-900">{formatDate(result.date)}</dd></div>
        <div><dt className="text-xs font-semibold text-muted">Panel</dt><dd className="mt-1 text-sm font-bold text-navy-900">{result.panel}</dd></div>
        <div><dt className="text-xs font-semibold text-muted">Source category</dt><dd className="mt-1 text-sm font-bold text-navy-900">{categoryLabels[result.category] ?? 'Report'}</dd></div>
      </dl>
      <div className="flex items-start gap-2 rounded-xl border border-ice-200 bg-white p-3 text-xs leading-5 text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
        This is fictional sample data for a frontend demonstration. Use the reference range printed on the original report and discuss results with a qualified healthcare professional.
      </div>
      <div className="flex flex-wrap gap-2">
        <Button to={`/records/${result.documentId}`}><ExternalLink aria-hidden="true" /> Open source record</Button>
        <Button to={`/copilot?q=${encodeURIComponent(`Explain the sample ${result.name} result`)}`} variant="secondary">Ask AI Copilot</Button>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  useDocumentTitle('Lab Reports & Results')
  const { reports, documents } = useHealthData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('date-desc')
  const [selectedResultId, setSelectedResultId] = useState(null)
  const [selectedTrend, setSelectedTrend] = useState('Cholesterol (Total)')

  const focus = organFocusAreas.find((area) => area.id === searchParams.get('focus'))
  const focusedDocuments = focus ? documents.filter((doc) => doc.organs?.includes(focus.id)) : []

  const availableReports = useMemo(
    () => reports.filter((report) => documents.some((document) => document.id === report.documentId)).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [reports, documents],
  )

  const allResults = useMemo(() => availableReports.flatMap((report) => (report.labValues ?? []).map((value) => {
    const document = documents.find((item) => item.id === report.documentId)
    const status = deriveLabStatus(value)
    return {
      ...value,
      resultId: `${report.id}:${value.id}`,
      reportId: report.id,
      documentId: report.documentId,
      reportTitle: report.title,
      panel: report.panel ?? report.title,
      date: report.date ?? document?.date ?? '',
      category: report.category ?? 'other',
      status,
      statusLabel: LAB_STATUSES[status]?.label ?? 'Not assessed',
    }
  })), [availableReports, documents])

  const filteredResults = useMemo(() => {
    const term = query.trim().toLowerCase()
    const filtered = allResults.filter((item) => {
      const matchCategory = category === 'all' || item.category === category
      const matchQuery = !term || [item.name, item.reportTitle, item.panel, item.value, item.unit, item.range, categoryLabels[item.category]]
        .some((value) => String(value ?? '').toLowerCase().includes(term))
      return matchCategory && matchQuery
    })
    return filtered.sort((a, b) => {
      if (sort === 'date-asc') return a.date.localeCompare(b.date) || a.name.localeCompare(b.name)
      if (sort === 'name-asc') return a.name.localeCompare(b.name) || b.date.localeCompare(a.date)
      if (sort === 'status') return a.status.localeCompare(b.status) || b.date.localeCompare(a.date)
      return b.date.localeCompare(a.date) || a.name.localeCompare(b.name)
    })
  }, [allResults, category, query, sort])

  const selectedResult = allResults.find((result) => result.resultId === selectedResultId) ?? null
  const statusCounts = useMemo(() => ({
    total: allResults.length,
    normal: allResults.filter((item) => item.status === 'normal').length,
    flagged: allResults.filter((item) => ['low', 'high'].includes(item.status)).length,
    reports: availableReports.length,
  }), [allResults, availableReports])

  const trendSeries = useMemo(() => {
    const grouped = new Map()
    allResults.forEach((item) => {
      if (typeof item.value !== 'number' || !item.unit) return
      const key = `${item.name}|||${item.unit}`
      const group = grouped.get(key) ?? { name: item.name, unit: item.unit, points: [] }
      group.points.push({ date: item.date, value: item.value, reportTitle: item.reportTitle })
      grouped.set(key, group)
    })
    return [...grouped.values()].filter((group) => group.points.length > 1).sort((a, b) => a.name.localeCompare(b.name))
  }, [allResults])

  const activeTrendName = trendSeries.some((series) => series.name === selectedTrend)
    ? selectedTrend
    : trendSeries[0]?.name ?? ''
  // Keep all available series so the user can switch the trend chart between comparable tests.
  const chartSeries = trendSeries

  const exportCsv = () => {
    if (!filteredResults.length) return
    const blob = new Blob([makeCsv(filteredResults)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'healthsaathi-lab-results-demo.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setQuery('')
    setCategory('all')
    setSort('date-desc')
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        eyebrow="REPORTS & RESULTS"
        title={focus ? focus.title : 'Lab reports & test results'}
        description={focus ? focus.longDescription : 'Review sample measurements, compare historical values when compatible data exists, and open the original record.'}
        actions={<Button variant="secondary" onClick={exportCsv} disabled={!filteredResults.length}><Download aria-hidden="true" /> Export CSV</Button>}
      />

      {focus && (
        <section aria-label={`${focus.title} overview`} className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <SafeImage src={focus.image} fallbackIcon={HeartPulse} className="aspect-square w-28 shrink-0 overflow-hidden rounded-2xl sm:w-32" imgClassName="size-full object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-extrabold text-navy-900">Related records</h2><Badge tone="neutral">{focusedDocuments.length} records</Badge></div>
            {focusedDocuments.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {focusedDocuments.map((doc) => <li key={doc.id}><Link to={`/records/${doc.id}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-ice-200 bg-white px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-ice-50"><span className="truncate">{doc.title}</span><ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /></Link></li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">No related records in the current demo dataset.</p>}
          </div>
          <button type="button" aria-label="Clear organ focus" onClick={() => setSearchParams({}, { replace: true })} className="self-start rounded-full p-2 text-muted hover:bg-ice-100 sm:self-center"><X className="size-4" aria-hidden="true" /></button>
        </section>
      )}

      <section aria-label="Results summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard icon={FlaskConical} label="Measurements" value={statusCounts.total} caption="Across demo reports" iconTone="blue" />
        <SummaryCard icon={Activity} label="Within range" value={statusCounts.normal} caption="Using supplied ranges" iconTone="green" />
        <SummaryCard icon={statusCounts.flagged ? TrendingUp : TrendingDown} label="Outside range" value={statusCounts.flagged} caption="Not a diagnosis" iconTone={statusCounts.flagged ? 'amber' : 'green'} />
        <SummaryCard icon={FileText} label="Reports available" value={statusCounts.reports} caption="Linked sample reports" iconTone="violet" />
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="panel min-w-0 p-5 sm:p-6">
          <TrendChart series={chartSeries} selectedName={activeTrendName} onSelect={setSelectedTrend} />
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted"><Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />Trend lines only include repeated numeric measurements with matching names and units. Data shown here is fictional.</p>
        </div>
        <div className="panel min-w-0 p-5 sm:p-6">
          <div className="flex items-center gap-2"><Lightbulb className="size-5 text-brand-600" aria-hidden="true" /><h2 className="text-base font-extrabold text-navy-900">Latest report overview</h2></div>
          {availableReports.length ? (
            <div className="mt-4 rounded-2xl border border-ice-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="lime">Demo data</Badge><span className="flex items-center gap-1 text-xs text-muted"><CalendarDays className="size-3.5" aria-hidden="true" />{formatDate(availableReports[0].date)}</span></div>
              <h3 className="mt-3 text-lg font-extrabold text-navy-900">{availableReports[0].title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{availableReports[0].summary}</p>
              <div className="mt-4 rounded-xl bg-brand-50 p-3.5"><p className="text-xs font-bold uppercase tracking-wide text-brand-700">What to discuss with a clinician</p><p className="mt-1.5 text-sm leading-5 text-navy-800">{availableReports[0].suggestion}</p></div>
              <Button to={`/records/${availableReports[0].documentId}`} variant="secondary" className="mt-4 w-full">Open source report <ExternalLink aria-hidden="true" /></Button>
            </div>
          ) : <EmptyState icon={FileText} title="No reports available" description="Uploaded lab reports will appear here when included in your records." />}
        </div>
      </section>

      <section className="panel min-w-0 p-4 sm:p-6" aria-labelledby="all-results-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><h2 id="all-results-title" className="text-lg font-extrabold text-navy-900">All test results</h2><Badge>{filteredResults.length} shown</Badge></div><p className="mt-1 text-sm text-muted">Search, filter and sort the values in your sample reports.</p></div>
          <div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto] lg:w-[26rem]">
            <label className="relative block"><span className="sr-only">Search results</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" /><input className="field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tests or reports" /></label>
            <label className="flex items-center gap-2"><span className="sr-only">Sort results</span><ArrowDownUp className="size-4 shrink-0 text-muted" aria-hidden="true" /><select className="field min-w-0 sm:w-40" value={sort} onChange={(event) => setSort(event.target.value)}><option value="date-desc">Latest first</option><option value="date-asc">Oldest first</option><option value="name-asc">Test name A–Z</option><option value="status">Group by status</option></select></label>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter results by category">
          {categories.map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)} className={cn('shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors', category === item.id ? 'bg-navy-900 text-white' : 'border border-ice-200 bg-white text-navy-800 hover:bg-ice-50')}>{item.label}</button>)}
        </div>

        {filteredResults.length ? (
          <>
            {/* Mobile View: Responsive Cards (< md) */}
            <div className="mt-3 space-y-2.5 md:hidden">
              {filteredResults.map((item) => (
                <div
                  key={item.resultId}
                  className="rounded-2xl border border-ice-200 bg-white/95 p-3.5 shadow-2xs transition hover:border-brand-200"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <LabValueIcon name={item.icon} />
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-navy-900 truncate">{item.name}</p>
                        <p className="text-xs text-muted truncate">{item.reportTitle}</p>
                      </div>
                    </div>
                    <LabStatusBadge status={item.status} />
                  </div>

                  <div className="mt-3 flex items-baseline justify-between border-t border-ice-100 pt-2.5">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Measured Value</span>
                      <span className="text-base font-extrabold text-navy-900 tabular-nums">
                        {formatValue(item.value)}{item.unit ? ` ${item.unit}` : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Reference Range</span>
                      <span className="text-xs font-semibold text-navy-800">
                        {item.range || 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-ice-50 pt-2 text-xs text-muted">
                    <span className="text-[11px]">{formatDate(item.date)}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedResultId(item.resultId)}
                      className="rounded-lg bg-ice-50 px-3 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50 cursor-pointer"
                    >
                      View details →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Full Table (>= md) */}
            <div className="mt-3 hidden md:block overflow-x-auto rounded-2xl border border-ice-200 bg-white/75">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">HealthSaathi sample lab measurements and report observations</caption>
                <thead className="bg-ice-50/90 text-xs text-muted">
                  <tr className="border-b border-ice-200">
                    <th scope="col" className="px-4 py-3 font-semibold">Test / measurement</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Result</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Reference range</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Report date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((item) => (
                    <tr key={item.resultId} className="border-b border-ice-100 last:border-0 hover:bg-ice-50/70">
                      <th scope="row" className="px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <LabValueIcon name={item.icon} />
                          <div className="min-w-0">
                            <p className="font-bold text-navy-900">{item.name}</p>
                            <p className="mt-0.5 max-w-56 truncate text-xs font-normal text-muted">{item.reportTitle}</p>
                          </div>
                        </div>
                      </th>
                      <td className="px-4 py-3.5 font-bold tabular-nums text-navy-900">
                        {formatValue(item.value)}{item.unit ? ` ${item.unit}` : ''}
                      </td>
                      <td className="px-4 py-3.5 text-muted">
                        {item.range || 'Not provided'}{item.range && typeof item.value === 'number' && item.unit ? ` ${item.unit}` : ''}
                      </td>
                      <td className="px-4 py-3.5"><LabStatusBadge status={item.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-muted">{formatDate(item.date)}</td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedResultId(item.resultId)}
                          className="rounded-full border border-ice-200 bg-white px-3.5 py-2 text-xs font-bold text-navy-900 hover:border-brand-200 hover:bg-brand-50 cursor-pointer"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-ice-300 bg-ice-50/60 p-5 sm:p-8">
            <EmptyState icon={Search} title="No matching results" description={category !== 'all' ? `There are no structured result values in the ${categories.find((item) => item.id === category)?.label.toLowerCase()} category in this demo dataset, or your search narrowed them out.` : 'Try another test name, report title, or search term.'} action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
            {category === 'imaging' && <p className="mt-2 text-center text-xs text-muted">Imaging files and narrative findings can still be opened from <Link to="/records" className="font-semibold text-brand-700 underline">My Records</Link>.</p>}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-ice-100 pt-4 text-xs leading-5 text-muted sm:flex-row sm:items-start"><Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" /><p>All values on this screen are fictional demo data. Status labels are derived from the explicit sample reference ranges when those ranges can be parsed; the labels are not diagnoses and do not replace the reference range on the source report.</p></div>
      </section>

      <Modal open={Boolean(selectedResult)} onClose={() => setSelectedResultId(null)} title={selectedResult?.name ?? 'Result details'} description={selectedResult?.reportTitle ?? 'Sample result details'}>
        <ResultDetail result={selectedResult} />
      </Modal>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, caption, iconTone = 'blue' }) {
  const tones = {
    blue: 'bg-sky-100 text-sky-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    violet: 'bg-violet-100 text-violet-700',
  }
  return (
    <article className="panel flex min-w-0 items-center gap-2.5 p-3 sm:gap-4 sm:p-5">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl sm:size-12 sm:rounded-2xl', tones[iconTone])}>
        <Icon className="size-5 sm:size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-muted sm:text-sm">{label}</p>
        <p className="mt-0.5 text-xl font-extrabold tracking-tight text-navy-900 tabular-nums sm:text-2xl">{value}</p>
        <p className="mt-0.5 truncate text-[10px] leading-4 text-muted sm:text-xs">{caption}</p>
      </div>
    </article>
  )
}
