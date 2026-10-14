import { useEffect, useState } from 'react'
import { Bell, Check, Globe2, HeartPulse, LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react'
import { Badge } from '../components/common/Badge.jsx'
import { Button } from '../components/common/Button.jsx'
import { SafeImage } from '../components/common/SafeImage.jsx'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { useHealthData } from '../context/HealthDataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

const tabs = [
  { id: 'personal', label: 'Personal info', icon: UserRound },
  { id: 'health', label: 'Health info', icon: HeartPulse },
  { id: 'preferences', label: 'Preferences', icon: Globe2 },
  { id: 'privacy', label: 'Privacy & security', icon: ShieldCheck },
]

function getInitials(name) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

import { useTranslation } from 'react-i18next'
import { setAppLanguage } from '../i18n/index.js'

export default function ProfilePage() {
  const { t } = useTranslation()
  useDocumentTitle(t('profile.title'))
  const { user, updateUser } = useHealthData()
  const { notify } = useToast()
  const [tab, setTab] = useState('personal')

  const tabs = [
    { id: 'personal', label: t('profile.tabs_personal'), icon: UserRound },
    { id: 'health', label: t('profile.tabs_health'), icon: HeartPulse },
    { id: 'preferences', label: t('profile.tabs_preferences'), icon: Bell },
    { id: 'privacy', label: t('profile.tabs_privacy'), icon: ShieldCheck },
  ]
  const [savedForm, setSavedForm] = useState(() => toForm(user))
  const [form, setForm] = useState(() => toForm(user))

  useEffect(() => {
    const next = toForm(user)
    setSavedForm(next)
    setForm(next)
  }, [user])

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm)

  const save = async (event) => {
    event.preventDefault()
    if (tab === 'personal') {
      if (!form.fullName.trim()) { notify({ title: 'Name is required', description: 'Enter a name before saving.', tone: 'error' }); return }
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { notify({ title: 'Check the email address', description: 'Enter a valid email address.', tone: 'error' }); return }
    }
    const fullName = form.fullName.trim().replace(/\s+/g, ' ')
    const updatedPayload = {
      ...form,
      fullName,
      firstName: fullName ? fullName.split(' ')[0] : user.firstName,
      displayName: fullName.length > 20 ? `${fullName.slice(0, 18)}…` : fullName,
      email: form.email.trim(),
      preferences: {
        ...(user?.preferences || {}),
        language: form.preferredLanguage,
        preferredLanguage: form.preferredLanguage,
        hasSelectedLanguage: true,
      },
      preferredLanguage: form.preferredLanguage,
    }
    await updateUser(updatedPayload)
    setSavedForm({ ...form, fullName, email: form.email.trim() })
    notify({ title: t('common.saved'), description: 'Your profile changes have been saved successfully.' })
  }

  const cancelChanges = () => setForm(savedForm)

  const initials = getInitials(user.fullName || user.displayName || user.email)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={t('profile.eyebrow')} title={t('profile.title')} description={t('profile.description')} />

      <section className="panel overflow-hidden">
        <div className="relative bg-linear-to-r from-[#d9efff] via-[#eff8ff] to-[#d7f0ff] px-5 py-6 sm:px-8 sm:py-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 size-64 rounded-full bg-white/60 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            {user.avatar ? (
              <SafeImage src={user.avatar} alt="Profile avatar" fallbackIcon={UserRound} className="size-20 shrink-0 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-card" imgClassName="size-full object-cover" />
            ) : (
              <div className="grid size-20 shrink-0 place-items-center rounded-3xl border-4 border-white bg-linear-to-br from-brand-600 to-navy-800 text-2xl font-bold text-white shadow-card">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-extrabold tracking-tight text-navy-900">{user.fullName || user.displayName}</h2><Badge tone="brand">{t('topbar.verified_account')}</Badge></div><p className="mt-1 text-sm text-navy-800/75">{user.email}</p><p className="mt-2 text-xs text-navy-800/70">Your profile is securely synced with your HealthSaathi account.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-44"><ProfileMini label="Age" value={user.age || '—'} /><ProfileMini label="Blood group" value={user.bloodGroup || 'Not set'} /></div>
          </div>
        </div>
        <div className="border-b border-ice-200 bg-white/70 px-3 py-3 sm:px-6"><nav role="tablist" aria-label="Profile settings" className="flex gap-1 overflow-x-auto">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); cancelChanges() }} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-bold transition sm:px-4 sm:text-sm ${tab === item.id ? 'bg-navy-900 text-white' : 'text-muted hover:bg-ice-100 hover:text-navy-900'}`}><Icon className="size-4" />{item.label}</button> })}</nav></div>

        <form onSubmit={save} className="p-5 sm:p-8">
          {tab === 'personal' && <div className="max-w-3xl"><SectionIntro title={t('profile.tabs_personal')} description="Edit your personal profile and contact details." /><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={t('profile.full_name')}><input className="field" value={form.fullName} onChange={(event) => setField('fullName', event.target.value)} autoComplete="name" /></Field><Field label={t('profile.email')}><input type="email" className="field" value={form.email} onChange={(event) => setField('email', event.target.value)} autoComplete="email" /></Field><Field label={t('profile.phone')}><input className="field" value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="Optional" autoComplete="tel" /></Field><Field label={t('profile.dob')}><input type="date" className="field" value={form.dateOfBirth} onChange={(event) => setField('dateOfBirth', event.target.value)} /></Field><Field label={t('profile.age')}><input type="number" min="0" max="120" className="field" value={form.age} onChange={(event) => setField('age', event.target.value)} /></Field><Field label={t('profile.blood_group')}><select className="field" value={form.bloodGroup} onChange={(event) => setField('bloodGroup', event.target.value)}><option value="">Prefer not to say</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group}>{group}</option>)}</select></Field><Field label={t('profile.city')}><input className="field" value={form.city} onChange={(event) => setField('city', event.target.value)} autoComplete="address-level2" /></Field><Field label={t('profile.emergency_contact')}><input className="field" value={form.emergencyContact} onChange={(event) => setField('emergencyContact', event.target.value)} placeholder="Name or phone" /></Field></div></div>}

          {tab === 'health' && <div className="max-w-3xl"><SectionIntro title={t('profile.tabs_health')} description="Personal health background to guide your clinical consultations." /><div className="mt-5 grid gap-4"><Field label={t('profile.allergies')}><textarea className="field min-h-24 py-3" value={form.allergies} onChange={(event) => setField('allergies', event.target.value)} placeholder="Add known allergies (e.g. penicillin, peanut), or leave blank" /></Field><Field label={t('profile.conditions')}><textarea className="field min-h-24 py-3" value={form.conditions} onChange={(event) => setField('conditions', event.target.value)} placeholder="Known conditions (e.g. hypertension, asthma)" /></Field><Field label={t('profile.health_notes')}><textarea className="field min-h-28 py-3" value={form.healthNotes} onChange={(event) => setField('healthNotes', event.target.value)} placeholder="Notes to help prepare for your doctor visits" /></Field></div></div>}

          {tab === 'preferences' && <div className="max-w-3xl"><SectionIntro title={t('profile.tabs_preferences')} description={t('profile.language_description')} /><div className="mt-5 space-y-4"><Field label={t('profile.preferred_language')}><select className="field" value={form.preferredLanguage} onChange={(event) => { setField('preferredLanguage', event.target.value); setAppLanguage(event.target.value); }}><option value="en">English</option><option value="te">తెలుగు (Telugu)</option><option value="hi">हिन्दी (Hindi)</option></select></Field><PreferenceToggle title={t('profile.reminders_toggle')} description={t('profile.reminders_desc')} checked={form.notificationsEnabled} onChange={(checked) => setField('notificationsEnabled', checked)} /><PreferenceToggle title={t('profile.tips_toggle')} description={t('profile.tips_desc')} checked={form.tipsEnabled} onChange={(checked) => setField('tipsEnabled', checked)} /></div></div>}

          {tab === 'privacy' && <div className="max-w-3xl"><SectionIntro title={t('profile.tabs_privacy')} description="Your health data is protected with enterprise Firebase Authentication and access controls." /><div className="mt-5 space-y-3"><PrivacyRow icon={LockKeyhole} title="Secure Cloud & Session Storage" description="Your authenticated credentials and medical records are securely encrypted and protected." /><PrivacyRow icon={Bell} title="Configurable Notifications" description="Manage alerts and reminder schedules according to your personal health preferences." /><PrivacyRow icon={ShieldCheck} title="Verified Authenticated Account" description="Your data is strictly linked to your authenticated user account and never shared." /></div></div>}

          {tab !== 'privacy' && <div className="mt-7 flex flex-col-reverse gap-2 border-t border-ice-100 pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={cancelChanges} disabled={!isDirty}>{t('profile.discard_btn')}</Button><Button type="submit" disabled={!isDirty}><Save className="size-4" /> {t('profile.save_btn')}</Button></div>}
        </form>
      </section>
    </div>
  )
}

function toForm(user) {
  const currentLang = user.preferences?.language || user.preferences?.preferredLanguage || user.preferredLanguage || 'en'
  return {
    fullName: user.fullName || user.displayName || '', email: user.email || '', phone: user.phone || '', dateOfBirth: user.dateOfBirth || '', age: user.age === undefined || user.age === null ? '' : String(user.age), bloodGroup: user.bloodGroup || '', city: user.city || '', emergencyContact: user.emergencyContact || '', allergies: user.allergies || '', conditions: user.conditions || '', healthNotes: user.healthNotes || '', preferredLanguage: currentLang, notificationsEnabled: user.notificationsEnabled ?? true, tipsEnabled: user.tipsEnabled ?? true,
  }
}
function ProfileMini({ label, value }) { return <div className="rounded-2xl border border-white bg-white/75 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p><p className="mt-1 text-sm font-extrabold text-navy-900">{value}</p></div> }
function SectionIntro({ title, description }) { return <div><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-brand-100 text-brand-700"><Check className="size-4" /></span><h3 className="text-lg font-extrabold text-navy-900">{title}</h3></div><p className="mt-2 text-sm text-muted">{description}</p></div> }
function Field({ label, children }) { return <label className="block text-sm font-semibold text-navy-900">{label}<span className="mt-1.5 block">{children}</span></label> }
function PreferenceToggle({ title, description, checked, onChange }) { return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-ice-200 bg-white p-4"><span><span className="block text-sm font-bold text-navy-900">{title}</span><span className="mt-1 block text-xs text-muted">{description}</span></span><input type="checkbox" className="size-5 shrink-0 accent-blue-700" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} /></label> }
function PrivacyRow({ icon: Icon, title, description }) { return <div className="flex items-start gap-3 rounded-2xl border border-ice-200 bg-white p-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon className="size-5" /></span><div><p className="text-sm font-bold text-navy-900">{title}</p><p className="mt-1 text-sm leading-5 text-muted">{description}</p></div></div> }
