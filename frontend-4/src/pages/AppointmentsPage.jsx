import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Edit3, Info, MapPin, Plus, Search, Stethoscope, Trash2, Video } from 'lucide-react'
import { Badge } from '../components/common/Badge.jsx'
import { Button } from '../components/common/Button.jsx'
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx'
import { EmptyState } from '../components/common/EmptyState.jsx'
import { Modal } from '../components/common/Modal.jsx'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { useHealthData } from '../context/HealthDataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { formatDate } from '../utils/documents.js'

const today = () => new Date().toISOString().slice(0, 10)
const blankAppointment = { doctorName: '', specialty: 'General Physician', date: today(), time: '10:00', location: '', visitType: 'In person', status: 'scheduled', notes: '' }

export default function AppointmentsPage() {
  useDocumentTitle('Appointments')
  const { appointments, addAppointment, updateAppointment, removeAppointment } = useHealthData()
  const { notify } = useToast()
  const [tab, setTab] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [form, setForm] = useState(blankAppointment)
  const [errors, setErrors] = useState({})

  const filtered = useMemo(() => appointments.filter((item) => {
    const isPast = item.status === 'completed' || item.status === 'cancelled' || item.date < today()
    const matchesTab = tab === 'all' || (tab === 'past' ? isPast : !isPast)
    const matchesSearch = `${item.doctorName} ${item.specialty} ${item.location}`.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  }).sort((a, b) => tab === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)), [appointments, tab, search])

  const openAdd = () => { setEditing(null); setForm({ ...blankAppointment, date: today() }); setErrors({}); setModalOpen(true) }
  const openEdit = (item) => { setEditing(item); setForm({ ...blankAppointment, ...item }); setErrors({}); setModalOpen(true) }
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  const submit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.doctorName.trim()) nextErrors.doctorName = 'Enter a doctor or provider name.'
    if (!form.location.trim()) nextErrors.location = 'Enter a clinic or visit location.'
    if (!form.date) nextErrors.date = 'Choose a date.'
    if (!form.time) nextErrors.time = 'Choose a time.'
    if (form.date < today() && !editing) nextErrors.date = 'Choose today or a future date for a new appointment.'
    if (form.date < today() && editing && editing.status !== 'completed') nextErrors.date = 'A rescheduled appointment cannot be in the past.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const payload = { ...form, doctorName: form.doctorName.trim(), location: form.location.trim(), notes: form.notes.trim() }
    if (editing) { updateAppointment(editing.id, payload); notify({ title: 'Appointment updated', description: `Changes for ${payload.doctorName} were saved.` }) }
    else { addAppointment(payload); notify({ title: 'Appointment scheduled', description: `Consultation with ${payload.doctorName} was added.` }) }
    setModalOpen(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Plan your next visit" title="Appointments" description="Organize upcoming doctor visits, specialist consultations, and notes in one place." actions={<Button onClick={openAdd}><Plus /> Schedule appointment</Button>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <AppointmentSummary label="Upcoming" value={appointments.filter((item) => item.status === 'scheduled' && item.date >= today()).length} icon={CalendarDays} />
        <AppointmentSummary label="Completed" value={appointments.filter((item) => item.status === 'completed').length} icon={CheckCircle2} />
        <AppointmentSummary label="Visit format" value="In person / online" icon={Video} />
      </div>

      <section className="panel p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Appointment views">
            {[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-navy-900 text-white' : 'bg-ice-50 text-muted hover:bg-ice-100'}`}>{label}</button>)}
          </div>
          <label className="relative block w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><span className="sr-only">Search appointments</span><input className="field pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search doctor or clinic..." /></label>
        </div>

        {filtered.length ? <div className="mt-5 grid gap-3 lg:grid-cols-2">{filtered.map((item) => {
          const isCancelled = item.status === 'cancelled'
          const isCompleted = item.status === 'completed'
          const isDatePast = item.date < today()
          return <article key={item.id} className="rounded-2xl border border-ice-200 bg-white/90 p-4 sm:p-5">
            <div className="flex items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Stethoscope className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold text-navy-900">{item.doctorName}</h2><Badge tone={isCancelled ? 'danger' : isCompleted ? 'success' : isDatePast ? 'neutral' : 'lime'}>{isCancelled ? 'Cancelled' : isCompleted ? 'Completed' : isDatePast ? 'Past' : 'Upcoming'}</Badge></div><p className="mt-1 text-sm text-muted">{item.specialty}</p></div><button type="button" onClick={() => openEdit(item)} aria-label={`Edit appointment with ${item.doctorName}`} className="rounded-xl p-2 text-muted hover:bg-ice-100"><Edit3 className="size-4" /></button></div>
            <div className="mt-4 space-y-2 rounded-xl bg-ice-50/80 p-3"><DetailLine icon={CalendarDays} text={formatDate(item.date)} /><DetailLine icon={Clock3} text={item.time} /><DetailLine icon={MapPin} text={item.location} /><DetailLine icon={item.visitType === 'Online' ? Video : Stethoscope} text={item.visitType || 'In person'} /></div>
            {item.notes && <p className="mt-3 rounded-xl border border-ice-100 p-3 text-sm text-muted"><span className="font-semibold text-navy-900">Notes:</span> {item.notes}</p>}
            <div className="mt-4 flex flex-wrap justify-between gap-2"><button type="button" onClick={() => { updateAppointment(item.id, { status: isCompleted ? 'scheduled' : 'completed' }); notify({ title: isCompleted ? 'Appointment reopened' : 'Marked completed', description: 'The appointment status has been updated.' }) }} className="text-xs font-bold text-brand-700 hover:underline">{isCompleted ? 'Reopen appointment' : 'Mark completed'}</button>{!isCancelled && !isCompleted && <button type="button" onClick={() => setCancelTarget(item)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="size-3.5" /> Cancel visit</button>}</div>
          </article>
        })}</div> : <EmptyState icon={CalendarDays} title="No appointments here" description={search ? 'Try another search or clear it.' : 'Schedule an appointment to start organizing upcoming visits.'} action={!search ? <Button onClick={openAdd}><Plus /> Add appointment</Button> : null} />}
        
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 text-xs text-navy-800">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <div className="space-y-0.5">
            <p className="font-bold text-navy-900">Clinical Consultation Preparation</p>
            <p className="leading-relaxed text-muted">
              Arrive 10–15 minutes before your scheduled appointment time. Keep your photo ID, current medication list, and recent lab records ready for your doctor.
            </p>
          </div>
        </div>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit appointment' : 'Schedule appointment'} description="Record upcoming clinic visits, specialist consultations, and preparation notes.">
        <form onSubmit={submit} noValidate className="space-y-4 px-6 py-5">
          <Field label="Doctor / provider name" error={errors.doctorName}><input className="field" value={form.doctorName} onChange={(event) => setField('doctorName', event.target.value)} placeholder="e.g. Dr. Ananya Mehta" aria-invalid={Boolean(errors.doctorName)} /></Field>
          <Field label="Specialty"><select className="field" value={form.specialty} onChange={(event) => setField('specialty', event.target.value)}><option>General Physician</option><option>Cardiologist</option><option>Dermatologist</option><option>Neurologist</option><option>Endocrinologist</option><option>Other</option></select></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Date" error={errors.date}><input type="date" min={editing?.status === 'completed' ? undefined : today()} className="field" value={form.date} onChange={(event) => setField('date', event.target.value)} aria-invalid={Boolean(errors.date)} /></Field><Field label="Time" error={errors.time}><input type="time" className="field" value={form.time} onChange={(event) => setField('time', event.target.value)} aria-invalid={Boolean(errors.time)} /></Field></div>
          <Field label="Clinic / location" error={errors.location}><input className="field" value={form.location} onChange={(event) => setField('location', event.target.value)} placeholder="Clinic name or online" aria-invalid={Boolean(errors.location)} /></Field>
          <Field label="Visit type"><select className="field" value={form.visitType} onChange={(event) => setField('visitType', event.target.value)}><option>In person</option><option>Online</option></select></Field>
          <Field label="Notes (optional)"><textarea className="field min-h-24 py-3" value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Questions or reports to bring" /></Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit">{editing ? 'Save changes' : 'Schedule appointment'}</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel this appointment?" description={cancelTarget ? `The appointment with ${cancelTarget.doctorName} will be marked as cancelled.` : ''} confirmLabel="Cancel appointment" onConfirm={() => { if (cancelTarget) { updateAppointment(cancelTarget.id, { status: 'cancelled' }); notify({ title: 'Appointment cancelled', description: `Appointment with ${cancelTarget.doctorName} was cancelled.` }); setCancelTarget(null) } }} />
    </div>
  )
}

function AppointmentSummary({ label, value, icon: Icon }) { return <div className="panel flex items-center gap-3 p-4"><span className="grid size-11 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon className="size-5" /></span><div><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-0.5 text-lg font-extrabold text-navy-900">{value}</p></div></div> }
function DetailLine({ icon: Icon, text }) { return <p className="flex items-center gap-2 text-sm text-navy-800"><Icon className="size-4 shrink-0 text-brand-600" />{text}</p> }
function Field({ label, error, children }) { return <label className="block text-sm font-semibold text-navy-900">{label}<span className="mt-1.5 block">{children}</span>{error && <span role="alert" className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}</label> }
