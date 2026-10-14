/**
 * Model adapters converting between Backend MongoDB/API schemas and Frontend UI models.
 * Ensures backward-compatibility with UI components while connecting to live backend endpoints.
 */

// ─── User Adapters ──────────────────────────────────────────────────────────

export function adaptBackendUser(backendUser) {
  if (!backendUser) return null
  const displayName = backendUser.displayName || backendUser.fullName || ''
  const firstName = displayName.split(' ')[0] || backendUser.email?.split('@')[0] || 'User'
  const avatar = backendUser.avatar || backendUser.photoUrl || ''

  return {
    id: backendUser._id ? String(backendUser._id) : backendUser.firebaseUid,
    firebaseUid: backendUser.firebaseUid,
    displayName: displayName || firstName,
    fullName: backendUser.fullName || displayName || firstName,
    firstName,
    avatar,
    photoUrl: avatar,
    email: backendUser.email || '',
    phone: backendUser.phone || '',
    dateOfBirth: backendUser.dateOfBirth || '',
    age: backendUser.age !== undefined && backendUser.age !== null ? backendUser.age : '',
    city: backendUser.city || '',
    gender: backendUser.gender || '',
    bloodGroup: backendUser.bloodGroup || '',
    allergies: backendUser.allergies || '',
    conditions: backendUser.conditions || '',
    emergencyContact: typeof backendUser.emergencyContact === 'string' ? backendUser.emergencyContact : (backendUser.emergencyContact?.name || ''),
    healthNotes: backendUser.healthNotes || '',
    preferences: {
      language: backendUser.preferences?.language || backendUser.preferences?.preferredLanguage || backendUser.preferredLanguage || 'en',
      preferredLanguage: backendUser.preferences?.preferredLanguage || backendUser.preferences?.language || backendUser.preferredLanguage || 'en',
      hasSelectedLanguage: backendUser.preferences?.hasSelectedLanguage ?? Boolean(backendUser.preferences?.language && backendUser.preferences.language !== ''),
      notifications: backendUser.preferences?.notifications ?? true,
      accessibility: backendUser.preferences?.accessibility || { highContrast: false, fontSize: 'medium' },
      shareWithFamily: backendUser.preferences?.shareWithFamily ?? false,
      enableReminders: backendUser.preferences?.enableReminders ?? true,
      labHighlightAbnormal: backendUser.preferences?.labHighlightAbnormal ?? true,
    },
    emailVerified: backendUser.emailVerified ?? false,
    providerId: backendUser.providerId || 'password',
  }
}

export function adaptUserForBackend(frontendUser) {
  if (!frontendUser) return {}
  return {
    displayName: frontendUser.displayName || frontendUser.fullName || frontendUser.firstName,
    fullName: frontendUser.fullName || frontendUser.displayName,
    avatar: frontendUser.avatar || frontendUser.photoUrl,
    phone: frontendUser.phone || undefined,
    dateOfBirth: frontendUser.dateOfBirth || undefined,
    age: frontendUser.age !== undefined && frontendUser.age !== '' ? frontendUser.age : undefined,
    city: frontendUser.city || undefined,
    bloodGroup: frontendUser.bloodGroup || undefined,
    allergies: frontendUser.allergies || undefined,
    conditions: frontendUser.conditions || undefined,
    healthNotes: frontendUser.healthNotes || undefined,
    emergencyContact: frontendUser.emergencyContact || undefined,
    preferences: frontendUser.preferences,
  }
}

// ─── Document Adapters ──────────────────────────────────────────────────────

const DOC_TYPE_TO_FRONTEND = {
  LAB_REPORT: 'lab',
  PRESCRIPTION: 'prescription',
  DISCHARGE_SUMMARY: 'discharge',
  SCAN: 'scan',
  VACCINATION: 'vaccine',
  OTHER: 'other',
}

const DOC_TYPE_TO_BACKEND = {
  lab: 'LAB_REPORT',
  prescription: 'PRESCRIPTION',
  discharge: 'DISCHARGE_SUMMARY',
  scan: 'SCAN',
  vaccine: 'VACCINATION',
  other: 'OTHER',
}

const DOC_STATUS_TO_FRONTEND = {
  READY: 'ready',
  READY_WITH_WARNINGS: 'ready',
  PROCESSING: 'processing',
  QUEUED: 'pending',
  UPLOADING: 'pending',
  FAILED: 'failed',
  DELETED: 'deleted',
}

export function adaptBackendDocument(doc) {
  if (!doc) return null
  const id = doc._id ? String(doc._id) : doc.id
  const type = DOC_TYPE_TO_FRONTEND[doc.documentType] || doc.type || 'other'
  const status = DOC_STATUS_TO_FRONTEND[doc.status] || doc.status?.toLowerCase() || 'ready'
  const date = doc.documentDate
    ? new Date(doc.documentDate).toISOString().slice(0, 10)
    : doc.date || new Date().toISOString().slice(0, 10)

  return {
    id,
    title: doc.name || doc.title || 'Untitled Document',
    fileName: doc.originalFilename || doc.fileName || doc.name,
    type,
    status,
    date,
    provider: doc.provider || doc.doctorName || 'Self-uploaded',
    summary: doc.summary || '',
    extractedText: doc.extractedText || '',
    storageKey: doc.storage?.objectKey || null,
    sizeBytes: doc.storage?.sizeBytes || 0,
    organs: Array.isArray(doc.organs) ? doc.organs : [],
    reportId: doc.reportId || null,
    findingsCount: doc.findingsCount || 0,
    rawBackend: doc,
  }
}

// ─── Medicine Adapters ──────────────────────────────────────────────────────

const MED_STATUS_TO_FRONTEND = {
  ACTIVE: 'current',
  COMPLETED: 'completed',
  PAUSED: 'archived',
  DISCONTINUED: 'archived',
}

const MED_STATUS_TO_BACKEND = {
  current: 'ACTIVE',
  completed: 'COMPLETED',
  archived: 'DISCONTINUED',
}

export function adaptBackendMedicine(med) {
  if (!med) return null
  return {
    id: med._id ? String(med._id) : med.id,
    name: med.name,
    dosage: med.strength || med.dosage || '',
    frequency: med.frequency || '',
    timing: med.timing || '',
    startDate: med.startDate ? new Date(med.startDate).toISOString().slice(0, 10) : med.startDate || '',
    endDate: med.endDate ? new Date(med.endDate).toISOString().slice(0, 10) : med.endDate || '',
    status: MED_STATUS_TO_FRONTEND[med.status] || med.status || 'current',
    notes: med.notes || '',
  }
}

export function adaptMedicineForBackend(med) {
  return {
    name: med.name,
    strength: med.dosage || med.strength || '',
    frequency: med.frequency || '',
    timing: med.timing || '',
    startDate: med.startDate ? new Date(med.startDate).toISOString() : undefined,
    endDate: med.endDate ? new Date(med.endDate).toISOString() : undefined,
    status: MED_STATUS_TO_BACKEND[med.status] || 'ACTIVE',
    notes: med.notes || '',
  }
}

// ─── Appointment Adapters ───────────────────────────────────────────────────

const APPT_STATUS_TO_FRONTEND = {
  SCHEDULED: 'upcoming',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'upcoming',
}

const APPT_STATUS_TO_BACKEND = {
  upcoming: 'SCHEDULED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
}

export function adaptBackendAppointment(appt) {
  if (!appt) return null
  let date = ''
  let time = ''
  if (appt.scheduledAt) {
    const d = new Date(appt.scheduledAt)
    date = d.toISOString().slice(0, 10)
    time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return {
    id: appt._id ? String(appt._id) : appt.id,
    doctor: appt.doctorName || appt.doctor || '',
    specialty: appt.specialty || '',
    date: date || appt.date || '',
    time: time || appt.time || '',
    location: appt.location || '',
    type: appt.visitType === 'TELEMEDICINE' ? 'Telemedicine' : 'In-person',
    status: APPT_STATUS_TO_FRONTEND[appt.status] || appt.status || 'upcoming',
    notes: appt.notes || '',
  }
}

export function adaptAppointmentForBackend(appt) {
  const scheduledAt = appt.date
    ? new Date(`${appt.date}T${appt.time || '10:00'}:00`).toISOString()
    : new Date().toISOString()

  return {
    doctorName: appt.doctor || appt.doctorName,
    specialty: appt.specialty || '',
    scheduledAt,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    location: appt.location || '',
    visitType: appt.type?.toLowerCase().includes('tele') ? 'TELEMEDICINE' : 'IN_PERSON',
    status: APPT_STATUS_TO_BACKEND[appt.status] || 'SCHEDULED',
    notes: appt.notes || '',
  }
}

// ─── Reminder Adapters ──────────────────────────────────────────────────────

const REM_CATEGORY_TO_FRONTEND = {
  MEDICINE: 'medicine',
  APPOINTMENT: 'appointment',
  GENERAL: 'general',
  TEST: 'test',
}

const REM_CATEGORY_TO_BACKEND = {
  medicine: 'MEDICINE',
  appointment: 'APPOINTMENT',
  general: 'GENERAL',
  test: 'TEST',
}

export function adaptBackendReminder(rem) {
  if (!rem) return null
  let date = ''
  let time = '09:00'
  if (rem.scheduledAtLocal) {
    if (rem.scheduledAtLocal.includes('T')) {
      const parts = rem.scheduledAtLocal.split('T')
      date = parts[0]
      time = parts[1].slice(0, 5)
    } else if (rem.scheduledAtLocal.includes('-')) {
      date = rem.scheduledAtLocal
    } else {
      time = rem.scheduledAtLocal.slice(0, 5)
    }
  }
  const repeatDisplay = rem.repeat === 'ONCE' ? 'Does not repeat' : (rem.repeat ? rem.repeat.charAt(0).toUpperCase() + rem.repeat.slice(1).toLowerCase() : 'Does not repeat')
  return {
    id: rem._id ? String(rem._id) : rem.id,
    title: rem.title,
    category: REM_CATEGORY_TO_FRONTEND[rem.category] || rem.category?.toLowerCase() || 'general',
    date: date || (rem.createdAt ? new Date(rem.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
    time: time || rem.time || '09:00',
    repeat: repeatDisplay,
    frequency: repeatDisplay,
    enabled: Boolean(rem.enabled),
    completed: Boolean(rem.completedAt),
    notes: rem.notes || '',
  }
}

export function adaptReminderForBackend(rem) {
  const repeatMap = {
    'does not repeat': 'ONCE',
    'once': 'ONCE',
    'daily': 'DAILY',
    'weekly': 'WEEKLY',
    'monthly': 'MONTHLY',
  }
  const cleanRepeat = (rem.repeat || rem.frequency || 'ONCE').toLowerCase().trim()
  const backendRepeat = repeatMap[cleanRepeat] || 'ONCE'

  let scheduledAtLocal = rem.time || '09:00'
  if (rem.date && rem.time) {
    scheduledAtLocal = `${rem.date}T${rem.time}`
  }

  return {
    title: rem.title,
    category: REM_CATEGORY_TO_BACKEND[rem.category?.toLowerCase()] || 'GENERAL',
    scheduledAtLocal,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    repeat: backendRepeat,
    enabled: rem.enabled !== false,
    notes: rem.notes || '',
  }
}
