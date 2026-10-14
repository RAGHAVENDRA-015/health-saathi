import { useMemo, useState } from 'react'
import { Bell, BellOff, CalendarDays, Check, Clock3, Edit3, Info, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { notificationsApi } from '../services/api/index.js'

const blankReminder = { title: '', category: 'medicine', date: new Date().toISOString().slice(0, 10), time: '09:00', repeat: 'Does not repeat', enabled: true, completed: false, notes: '' }
const categoryLabel = { medicine: 'Medicine', appointment: 'Appointment', report: 'Report follow-up', other: 'Other' }

export default function RemindersPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('reminders.title', 'Reminders'))
  const { reminders, addReminder, updateReminder, removeReminder } = useHealthData()
  const { notify } = useToast()
  const [tab, setTab] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(blankReminder)
  const [error, setError] = useState('')
  const [testingAlert, setTestingAlert] = useState(false)

  const handleTestAlert = async () => {
    setTestingAlert(true)
    try {
      await notificationsApi.triggerTest({ type: 'GENERAL' })
      notify({
        title: 'Test Notification Dispatched',
        description: 'Dispatched alert event. Watching for delivery...',
        tone: 'info',
      })
    } catch (err) {
      notify({
        title: 'Test Alert Failed',
        description: err.message || 'Unable to trigger test alert.',
        tone: 'warning',
      })
    } finally {
      setTestingAlert(false)
    }
  }

  const visible = useMemo(() => reminders.filter((item) => tab === 'all' || (tab === 'completed' ? item.completed : !item.completed && item.category === tab)), [reminders, tab])
  const openAdd = () => { setEditing(null); setForm({ ...blankReminder, date: new Date().toISOString().slice(0, 10) }); setError(''); setModalOpen(true) }
  const openEdit = (item) => { setEditing(item); setForm({ ...blankReminder, ...item }); setError(''); setModalOpen(true) }
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event) => {
    event.preventDefault()
    if (!form.title.trim()) { setError('Enter a reminder title.'); return }
    if (!form.date || !form.time) { setError('Choose a date and time.'); return }
    const payload = { ...form, title: form.title.trim(), notes: form.notes.trim() }
    if (editing) { updateReminder(editing.id, payload); notify({ title: 'Reminder updated', description: 'Your reminder has been saved.' }) }
    else { addReminder(payload); notify({ title: 'Reminder added', description: 'Your reminder has been scheduled.' }) }
    setModalOpen(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t('reminders.eyebrow', 'Stay organized')}
        title={t('reminders.title', 'Reminders')}
        description={t('reminders.description', 'Keep track of medicine schedules, appointment dates, and report follow-ups in one place.')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleTestAlert} disabled={testingAlert}>
              <Bell className="size-4" /> {testingAlert ? 'Testing...' : 'Test alert'}
            </Button>
            <Button onClick={openAdd}><Plus /> {t('reminders.new_reminder', 'Add reminder')}</Button>
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <ReminderStat icon={Bell} label={t('reminders.active_tab', 'Enabled')} value={reminders.filter((item) => item.enabled && !item.completed).length} />
        <ReminderStat icon={Check} label={t('reminders.completed_tab', 'Completed')} value={reminders.filter((item) => item.completed).length} />
        <ReminderStat icon={Bell} label={t('common.status', 'Alert status')} value="Active & Timed" />
      </div>
      <section className="panel p-4 sm:p-6">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Reminder categories">
          {[
            ['all', t('common.all', 'All reminders')],
            ['medicine', t('nav.medicines', 'Medicines')],
            ['appointment', t('nav.appointments', 'Appointments')],
            ['report', t('records.lab_reports', 'Reports')],
            ['completed', t('reminders.completed_tab', 'Completed')],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${tab === id ? 'bg-navy-900 text-white' : 'bg-ice-50 text-muted hover:bg-ice-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {visible.length ? <div className="mt-5 space-y-3">{visible.map((item) => <article key={item.id} className={`rounded-2xl border p-4 transition sm:p-5 ${item.completed ? 'border-ice-100 bg-ice-50/60' : 'border-ice-200 bg-white/90 hover:border-brand-200'}`}>
          <div className="flex items-start gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${item.enabled && !item.completed ? 'bg-brand-100 text-brand-700' : 'bg-ice-100 text-muted'}`}>{item.enabled && !item.completed ? <Bell className="size-5" /> : <BellOff className="size-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className={`font-extrabold ${item.completed ? 'text-muted line-through' : 'text-navy-900'}`}>{item.title}</h2><Badge tone={item.completed ? 'success' : item.enabled ? 'brand' : 'neutral'}>{item.completed ? 'Completed' : item.enabled ? 'Enabled' : 'Paused'}</Badge><Badge tone="neutral">{categoryLabel[item.category] || 'Other'}</Badge></div><p className="mt-1 text-sm text-muted">{item.notes || 'No additional notes.'}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-navy-800"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-brand-600" />{formatDate(item.date)}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-brand-600" />{item.time}</span><span className="rounded-full bg-ice-100 px-2 py-0.5">{item.repeat || 'Does not repeat'}</span></div></div><div className="flex gap-1"><button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`} className="rounded-xl p-2 text-muted hover:bg-ice-100"><Edit3 className="size-4" /></button><button type="button" onClick={() => setDeleteTarget(item)} aria-label={`Delete ${item.title}`} className="rounded-xl p-2 text-muted hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></button></div></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ice-100 pt-3"><button type="button" onClick={() => { updateReminder(item.id, { completed: !item.completed }); notify({ title: item.completed ? 'Reminder reopened' : 'Reminder completed', description: item.title }) }} className="text-xs font-bold text-brand-700 hover:underline">{item.completed ? 'Mark as incomplete' : 'Mark complete'}</button><button type="button" role="switch" aria-checked={Boolean(item.enabled)} disabled={item.completed} onClick={() => { updateReminder(item.id, { enabled: !item.enabled }); notify({ title: item.enabled ? 'Reminder paused' : 'Reminder enabled', description: item.enabled ? `${item.title} paused.` : `${item.title} enabled.` }) }} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${item.enabled && !item.completed ? 'bg-emerald-50 text-emerald-700' : 'bg-ice-100 text-muted'} disabled:opacity-50`}><span className={`relative h-4 w-7 rounded-full ${item.enabled && !item.completed ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${item.enabled && !item.completed ? 'left-3.5' : 'left-0.5'}`} /></span>{item.enabled ? 'Enabled' : 'Paused'}</button></div>
        </article>)}</div> : <EmptyState icon={Bell} title={t('reminders.no_reminders', 'No reminders in this view')} description="Add a reminder or choose another category to see your scheduled reminders." action={<Button onClick={openAdd}><Plus /> {t('reminders.new_reminder', 'Add reminder')}</Button>} />}
        
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 text-xs text-navy-800">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-600" />
          <div className="space-y-0.5">
            <p className="font-bold text-navy-900">Health Routine & Timing Alerts</p>
            <p className="leading-relaxed text-muted">
              Timely follow-ups and regular medication adherence are essential for effective health outcomes. Keep your reminders updated with accurate frequencies and dosage times.
            </p>
          </div>
        </div>
      </section>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit reminder' : 'Add a reminder'} description="Set up alerts for daily medication schedules, upcoming clinic visits, and diagnostic follow-ups.">
        <form onSubmit={submit} noValidate className="space-y-4 px-6 py-5">
          <Field label="Reminder title"><input className="field" value={form.title} onChange={(event) => { setField('title', event.target.value); setError('') }} placeholder="e.g. Prepare for follow-up visit" aria-invalid={Boolean(error)} /></Field>
          <Field label="Category"><select className="field" value={form.category} onChange={(event) => setField('category', event.target.value)}><option value="medicine">Medicine</option><option value="appointment">Appointment</option><option value="report">Report follow-up</option><option value="other">Other</option></select></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Date"><input type="date" className="field" value={form.date} onChange={(event) => setField('date', event.target.value)} /></Field><Field label="Time"><input type="time" className="field" value={form.time} onChange={(event) => setField('time', event.target.value)} /></Field></div>
          <Field label="Repeat"><select className="field" value={form.repeat} onChange={(event) => setField('repeat', event.target.value)}><option>Does not repeat</option><option>Daily</option><option>Weekly</option><option>Monthly</option></select></Field>
          <Field label="Notes (optional)"><textarea className="field min-h-24 py-3" value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Add a short note" /></Field>
          {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit">{editing ? 'Save changes' : 'Add reminder'}</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete this reminder?" description={deleteTarget ? `“${deleteTarget.title}” will be removed from your reminders.` : ''} confirmLabel="Delete reminder" onConfirm={() => { if (deleteTarget) { removeReminder(deleteTarget.id); notify({ title: 'Reminder deleted', description: deleteTarget.title }); setDeleteTarget(null) } }} />
    </div>
  )
}

function ReminderStat({ icon: Icon, label, value }) { return <div className="panel flex items-center gap-3 p-4"><span className="grid size-11 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon className="size-5" /></span><div><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-0.5 text-lg font-extrabold text-navy-900">{value}</p></div></div> }
function Field({ label, children }) { return <label className="block text-sm font-semibold text-navy-900">{label}<span className="mt-1.5 block">{children}</span></label> }
