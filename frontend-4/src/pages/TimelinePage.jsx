import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, FileText, Filter, History, Pill, Stethoscope } from 'lucide-react'
import { Badge } from '../components/common/Badge.jsx'
import { EmptyState } from '../components/common/EmptyState.jsx'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { useHealthData } from '../context/HealthDataContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { formatDate } from '../utils/documents.js'

const filters = [
  { id: 'all', label: 'All events' },
  { id: 'document', label: 'Medical records' },
  { id: 'appointment', label: 'Appointments' },
  { id: 'medicine', label: 'Medicines' },
]

export default function TimelinePage() {
  useDocumentTitle('Health Timeline')
  const { documents, appointments, medicines } = useHealthData()
  const [filter, setFilter] = useState('all')
  const [order, setOrder] = useState('newest')

  const events = useMemo(() => {
    const items = [
      ...documents.map((doc) => ({
        id: `document-${doc.id}`, date: doc.date, kind: 'document', title: doc.title,
        description: doc.description || doc.provider || 'Medical record', type: doc.type,
        to: `/records/${doc.id}`, icon: FileText, badge: doc.type === 'lab' ? 'Lab report' : doc.type === 'prescription' ? 'Prescription' : 'Diagnostic record',
      })),
      ...appointments.map((item) => ({
        id: `appointment-${item.id}`, date: item.date, kind: 'appointment', title: `${item.status === 'cancelled' ? 'Cancelled visit' : 'Appointment'} with ${item.doctorName}`,
        description: `${item.specialty} · ${item.location}`, to: '/appointments', icon: CalendarDays, badge: item.status === 'completed' ? 'Completed' : item.status === 'cancelled' ? 'Cancelled' : 'Appointment',
      })),
      ...medicines.map((item) => ({
        id: `medicine-${item.id}`, date: item.startDate || new Date().toISOString().slice(0, 10), kind: 'medicine', title: item.name,
        description: [item.strength, item.frequency, item.timing].filter(Boolean).join(' · '), to: '/medicines', icon: Pill, badge: item.status === 'past' ? 'Past medicine' : 'Medicine',
      })),
    ]
    return items
      .filter((item) => filter === 'all' || item.kind === filter)
      .sort((a, b) => (order === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
  }, [documents, appointments, medicines, filter, order])

  const grouped = useMemo(() => events.reduce((acc, event) => {
    const year = String(event.date || '').slice(0, 4) || 'Undated'
    if (!acc[year]) acc[year] = []
    acc[year].push(event)
    return acc
  }, {}), [events])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Your health journey" title="Health Timeline" description="Browse medical records, appointments and medicine entries together in chronological order." actions={<label className="flex items-center gap-2 rounded-full border border-ice-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900"><Filter className="size-4 text-brand-600" /><span className="sr-only">Sort timeline</span><select className="bg-transparent outline-none" value={order} onChange={(event) => setOrder(event.target.value)}><option value="newest">Latest first</option><option value="oldest">Oldest first</option></select></label>} />

      <nav aria-label="Timeline filters" className="flex flex-wrap gap-2">
        {filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filter === item.id ? 'bg-navy-900 text-white' : 'border border-white/90 bg-white/80 text-muted hover:bg-white'}`}>{item.label}</button>)}
      </nav>

      <section className="panel p-5 sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-extrabold text-navy-900">Your history at a glance</h2><p className="mt-1 text-sm text-muted">{events.length} {events.length === 1 ? 'event' : 'events'} · demo records</p></div>
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-100 text-brand-700"><History className="size-5" /></span>
        </div>
        {events.length ? <div className="space-y-8">
          {Object.entries(grouped).sort(([a], [b]) => order === 'newest' ? b.localeCompare(a) : a.localeCompare(b)).map(([year, yearEvents]) => <section key={year} aria-labelledby={`timeline-${year}`}>
            <h3 id={`timeline-${year}`} className="mb-4 inline-flex rounded-full bg-ice-100 px-3 py-1 text-sm font-extrabold text-navy-800">{year}</h3>
            <ol className="relative ml-3 space-y-3 border-l-2 border-brand-100 pl-6">
              {yearEvents.map((event) => { const Icon = event.icon; return <li key={event.id} className="relative rounded-2xl border border-ice-200 bg-white/85 p-4 transition hover:border-brand-200 hover:shadow-card sm:p-5">
                <span className="absolute -left-[2.12rem] top-5 grid size-7 place-items-center rounded-full border-4 border-white bg-brand-100 text-brand-700"><Icon className="size-3.5" /></span>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-navy-900">{event.title}</p><Badge tone={event.kind === 'appointment' ? 'lime' : event.kind === 'medicine' ? 'warning' : 'brand'}>{event.badge}</Badge></div><p className="mt-1 text-sm text-muted">{event.description}</p><p className="mt-2 text-xs font-semibold text-brand-700">{formatDate(event.date)}</p></div>
                  <Link to={event.to} className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-ice-200 px-4 text-sm font-bold text-navy-900 transition hover:bg-ice-50">View details</Link>
                </div>
              </li> })}
            </ol>
          </section>)}
        </div> : <EmptyState icon={History} title="No events match this filter" description="Try another timeline category or add a record, medicine or appointment to see it here." />}
        <p className="mt-6 flex items-start gap-2 rounded-xl bg-ice-50 p-3 text-xs leading-5 text-muted"><Stethoscope className="mt-0.5 size-4 shrink-0 text-brand-600" />This timeline is assembled from local demo entries. It is not a verified clinical record.</p>
      </section>
    </div>
  )
}
