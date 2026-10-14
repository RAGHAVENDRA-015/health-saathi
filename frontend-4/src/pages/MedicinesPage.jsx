import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BellRing, CalendarClock, Check, Clock3, Edit3, Info, Pill, Plus, Search, Trash2 } from 'lucide-react'
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

const blankMedicine = { name: '', strength: '', frequency: 'Once daily', timing: 'After breakfast', startDate: new Date().toISOString().slice(0, 10), endDate: '', status: 'current', notes: '' }
const tabs = [{ id: 'current', label: 'Current' }, { id: 'past', label: 'Past' }, { id: 'all', label: 'All medicines' }]

export default function MedicinesPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('medicines.title', 'Medicines'))
  const { medicines, addMedicine, updateMedicine, removeMedicine } = useHealthData()
  const { notify } = useToast()
  const [tab, setTab] = useState('current')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankMedicine)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [errors, setErrors] = useState({})

  const visibleMedicines = useMemo(() => medicines.filter((item) => {
    const matchesTab = tab === 'all' || item.status === tab
    const matchesSearch = `${item.name} ${item.strength} ${item.notes}`.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  }), [medicines, tab, search])

  const openAdd = () => { setEditing(null); setForm({ ...blankMedicine, startDate: new Date().toISOString().slice(0, 10) }); setErrors({}); setIsModalOpen(true) }
  const openEdit = (item) => { setEditing(item); setForm({ ...blankMedicine, ...item }); setErrors({}); setIsModalOpen(true) }
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Enter a medicine name.'
    if (!form.strength.trim()) nextErrors.strength = 'Add strength or dosage details.'
    if (!form.frequency.trim()) nextErrors.frequency = 'Choose a frequency.'
    if (form.endDate && form.startDate && form.endDate < form.startDate) nextErrors.endDate = 'End date cannot be before the start date.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const payload = { ...form, name: form.name.trim(), strength: form.strength.trim(), notes: form.notes.trim() }
    if (editing) { updateMedicine(editing.id, payload); notify({ title: 'Medicine updated', description: `${payload.name} was saved.` }) }
    else { addMedicine(payload); notify({ title: 'Medicine added', description: `${payload.name} was added to your medicine list.` }) }
    setIsModalOpen(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t('medicines.eyebrow', 'Medicine organizer')}
        title={t('medicines.title', 'My Medicines')}
        description={t('medicines.description', 'Keep your medicine information and schedules organized in one place.')}
        actions={<Button onClick={openAdd}><Plus aria-hidden="true" /> {t('medicines.add_medicine', 'Add medicine')}</Button>}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label={t('medicines.active_tab', 'Current medicines')} value={medicines.filter((item) => item.status === 'current').length} icon={Pill} />
        <SummaryCard label={t('medicines.past_tab', 'Past medicines')} value={medicines.filter((item) => item.status === 'past').length} icon={Check} />
        <SummaryCard label={t('common.status', 'Schedule tracking')} value={t('common.verified', 'Active')} icon={BellRing} text="Dosage alerts enabled" />
      </div>

      <section className="panel p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Medicine status">
            {tabs.map((item) => {
              const tabLabel = item.id === 'current' ? t('medicines.active_tab', 'Current') : item.id === 'past' ? t('medicines.past_tab', 'Past') : t('common.all', 'All medicines')
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === item.id ? 'bg-navy-900 text-white' : 'bg-ice-50 text-muted hover:bg-ice-100'}`}
                >
                  {tabLabel}
                </button>
              )
            })}
          </div>
          <label className="relative block w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><span className="sr-only">Search medicines</span><input className="field pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search medicines..." /></label>
        </div>

        {visibleMedicines.length ? <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {visibleMedicines.map((item) => <article key={item.id} className="rounded-2xl border border-ice-200 bg-white/90 p-4 transition hover:border-brand-200 hover:shadow-card sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Pill className="size-5" /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold text-navy-900">{item.name}</h2><Badge tone={item.status === 'current' ? 'success' : 'neutral'}>{item.status === 'current' ? 'Current' : 'Past'}</Badge></div><p className="mt-1 text-sm font-semibold text-brand-700">{item.strength || 'Strength not specified'}</p><p className="mt-2 text-sm text-muted">{item.notes || 'No notes added.'}</p></div>
              <div className="flex gap-1"><button type="button" className="rounded-xl p-2 text-muted hover:bg-ice-100 hover:text-navy-900" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}><Edit3 className="size-4" /></button><button type="button" className="rounded-xl p-2 text-muted hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleteTarget(item)} aria-label={`Delete ${item.name}`}><Trash2 className="size-4" /></button></div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-ice-50/90 p-3 text-sm sm:grid-cols-2">
              <InfoLine icon={Clock3} label="Frequency" value={item.frequency || 'Not specified'} />
              <InfoLine icon={CalendarClock} label="Timing" value={item.timing || 'Not specified'} />
              <InfoLine icon={CalendarClock} label="Started" value={item.startDate ? formatDate(item.startDate) : 'Not specified'} />
              {item.endDate && <InfoLine icon={CalendarClock} label="Ended" value={formatDate(item.endDate)} />}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => { updateMedicine(item.id, { status: item.status === 'current' ? 'past' : 'current' }); notify({ title: 'Medicine status updated', description: `${item.name} is now marked ${item.status === 'current' ? 'past' : 'current'}.` }) }} className="text-xs font-bold text-brand-700 hover:underline">Mark as {item.status === 'current' ? 'past' : 'current'}</button>
              <Link to="/reminders" className="inline-flex items-center gap-1.5 rounded-full border border-ice-200 bg-white px-3 py-2 text-xs font-bold text-navy-900 hover:bg-ice-50"><BellRing className="size-3.5" /> Manage reminders</Link>
            </div>
          </article>)}
        </div> : <EmptyState icon={Pill} title={t('medicines.no_medicines', 'No medicines found')} description={search ? 'Try a different search term or clear your search.' : 'Add a medicine to begin organizing your schedule.'} action={!search ? <Button onClick={openAdd}><Plus /> {t('medicines.add_medicine', 'Add medicine')}</Button> : null} />}

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 text-xs text-navy-800">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <div className="space-y-0.5">
            <p className="font-bold text-navy-900">Medication Safety & Adherence</p>
            <p className="leading-relaxed text-muted">
              Always take prescribed medications according to dosage and timing instructions provided by your clinician or licensed pharmacist. Keep your emergency contact and active prescription details up to date.
            </p>
          </div>
        </div>
      </section>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? 'Edit medicine' : 'Add a medicine'} description="Keep your medication details, dosage schedules, and doctor notes up to date.">
        <form className="space-y-4 px-6 py-5" onSubmit={handleSubmit} noValidate>
          <FormField label="Medicine name" error={errors.name}><input className="field" value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="e.g. Paracetamol" aria-invalid={Boolean(errors.name)} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Strength / dosage" error={errors.strength}><input className="field" value={form.strength} onChange={(event) => setField('strength', event.target.value)} placeholder="e.g. 650 mg" aria-invalid={Boolean(errors.strength)} /></FormField><FormField label="Frequency" error={errors.frequency}><select className="field" value={form.frequency} onChange={(event) => setField('frequency', event.target.value)}><option>Once daily</option><option>Twice daily</option><option>Once weekly</option><option>As needed</option><option>As directed</option></select></FormField></div>
          <FormField label="Timing"><select className="field" value={form.timing} onChange={(event) => setField('timing', event.target.value)}><option>Before breakfast</option><option>After breakfast</option><option>After lunch</option><option>After dinner</option><option>At bedtime</option><option>Sunday morning</option><option>As directed by clinician</option></select></FormField>
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Start date"><input type="date" className="field" value={form.startDate} onChange={(event) => setField('startDate', event.target.value)} /></FormField><FormField label="End date (optional)" error={errors.endDate}><input type="date" className="field" value={form.endDate} onChange={(event) => setField('endDate', event.target.value)} aria-invalid={Boolean(errors.endDate)} /></FormField></div>
          <FormField label="Status"><select className="field" value={form.status} onChange={(event) => setField('status', event.target.value)}><option value="current">Current</option><option value="past">Past</option></select></FormField>
          <FormField label="Notes (optional)"><textarea className="field min-h-24 py-3" value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Add instructions or notes from your doctor or pharmacy" /></FormField>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button type="submit">{editing ? 'Save changes' : 'Add medicine'}</Button></div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete this medicine?" description={deleteTarget ? `${deleteTarget.name} will be removed from your medicine list.` : ''} confirmLabel="Delete medicine" onConfirm={() => { if (deleteTarget) { removeMedicine(deleteTarget.id); notify({ title: 'Medicine deleted', description: `${deleteTarget.name} was removed.` }); setDeleteTarget(null) } }} />
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, text }) { return <div className="panel flex items-center gap-3 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon className="size-5" /></span><div><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-0.5 text-xl font-extrabold text-navy-900">{value}</p>{text && <p className="text-[11px] text-muted">{text}</p>}</div></div> }
function InfoLine({ icon: Icon, label, value }) { return <div className="flex items-start gap-2"><Icon className="mt-0.5 size-4 shrink-0 text-brand-600" /><div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p><p className="mt-0.5 text-xs font-semibold text-navy-900">{value}</p></div></div> }
function FormField({ label, error, children }) { return <label className="block text-sm font-semibold text-navy-900">{label}<span className="mt-1.5 block">{children}</span>{error && <span role="alert" className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}</label> }
