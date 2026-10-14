import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { mockDocuments } from '../data/mockDocuments.js'
import { mockReports } from '../data/mockReports.js'
import { mockAppointmentsData, mockMedicinesData, mockRemindersData } from '../data/mockManagement.js'
import { mockNotifications, mockUser } from '../data/mockUser.js'
import { usePersistentState } from '../hooks/usePersistentState.js'
import { storageService } from '../services/storageService.js'
import { getDocumentStats, isValidDocumentList, sortByDateDesc } from '../utils/documents.js'
import { documentsApi, medicinesApi, appointmentsApi, remindersApi } from '../services/api/index.js'
import { useAuth } from './AuthContext.jsx'
import { useToast } from './ToastContext.jsx'
import { useNotificationForegroundListener } from '../services/notificationService.js'

const HealthDataContext = createContext(null)
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string')
const MAX_RECENT_SEARCHES = 5
const isValidUser = (value) => Boolean(
  value && typeof value === 'object' && typeof value.firstName === 'string' &&
  typeof value.displayName === 'string' && typeof value.email === 'string'
)

export function HealthDataProvider({ children }) {
  const auth = useAuth()
  const { notify } = useToast()
  useNotificationForegroundListener(notify, auth?.isLiveAuth)
  const [localUser, setLocalUser] = usePersistentState('profile', mockUser, isValidUser)
  const user = auth?.user ?? localUser
  const updateUser = useCallback(
    (patch) => {
      if (auth?.updateProfile) {
        return auth.updateProfile(patch)
      }
      return setLocalUser((current) => ({ ...current, ...patch }))
    },
    [auth, setLocalUser],
  )

  // Actual File objects are kept in memory only; never serialize file bytes to localStorage.
  const [localFiles, setLocalFiles] = useState({})
  const [documents, setDocuments] = usePersistentState('documents', mockDocuments, isValidDocumentList)

  // One-time migration for users who already have Phase 3 demo records in localStorage.
  useEffect(() => {
    const alreadyMigrated = storageService.get('phase4DocumentMigration', false, (value) => typeof value === 'boolean')
    if (alreadyMigrated) return
    const defaultsById = new Map(mockDocuments.map((doc) => [doc.id, doc]))
    setDocuments((current) => {
      const migrated = current.map((doc) => {
        const baseline = defaultsById.get(doc.id)
        if (!baseline) return doc
        return {
          ...baseline,
          ...doc,
          reportId: doc.reportId || baseline.reportId,
          organs: Array.isArray(doc.organs) ? doc.organs : (baseline.organs ?? []),
        }
      })
      const existingIds = new Set(migrated.map((doc) => doc.id))
      const newlySeededDocs = mockDocuments.filter((doc) => !existingIds.has(doc.id) && doc.id === 'doc-urinalysis')
      return [...newlySeededDocs, ...migrated]
    })
    storageService.set('phase4DocumentMigration', true)
  }, [setDocuments])

  const [medicines, setMedicines] = usePersistentState('medicines', mockMedicinesData, Array.isArray)
  const [appointments, setAppointments] = usePersistentState('appointments', mockAppointmentsData, Array.isArray)
  const [reminders, setReminders] = usePersistentState('reminders', mockRemindersData, Array.isArray)
  const [readNotificationIds, setReadNotificationIds] = usePersistentState('readNotifications', [], isStringArray)
  const [recentSearches, setRecentSearches] = usePersistentState('recentSearches', [], isStringArray)
  const [isLoadingBackend, setIsLoadingBackend] = useState(false)

  const currentUserId = auth?.isLiveAuth ? (auth?.user?.uid || auth?.user?.id || auth?.user?.email || null) : null
  const prevUserIdRef = useRef(currentUserId)

  // 1. Purge legacy un-scoped clinical data from localStorage to prevent cross-account leak
  useEffect(() => {
    if (auth?.isLiveAuth) {
      storageService.remove('documents')
      storageService.remove('medicines')
      storageService.remove('appointments')
      storageService.remove('reminders')
    }
  }, [auth?.isLiveAuth])

  // 2. Immediate user switch isolation: wipe or restore scoped user data whenever active user identity changes
  useEffect(() => {
    if (prevUserIdRef.current !== currentUserId) {
      prevUserIdRef.current = currentUserId
      if (currentUserId) {
        // Scoped cache for this specific user
        const userDocsKey = `documents_${currentUserId}`
        const cachedDocs = storageService.get(userDocsKey, null)
        setDocuments(cachedDocs || [])
        setMedicines(storageService.get(`medicines_${currentUserId}`, []))
        setAppointments(storageService.get(`appointments_${currentUserId}`, []))
        setReminders(storageService.get(`reminders_${currentUserId}`, []))
        setLocalFiles({})
      } else {
        // Logged out / unauthenticated: return to demo baseline
        setDocuments(mockDocuments)
        setMedicines(mockMedicinesData)
        setAppointments(mockAppointmentsData)
        setReminders(mockRemindersData)
        setLocalFiles({})
      }
    }
  }, [currentUserId, setDocuments, setMedicines, setAppointments, setReminders])

  // 3. Synchronize live data when authenticated with backend
  useEffect(() => {
    if (!auth?.isLiveAuth) return

    let isMounted = true
    async function loadBackendData() {
      setIsLoadingBackend(true)
      try {
        const [docsRes, medsRes, apptsRes, remsRes] = await Promise.allSettled([
          documentsApi.getDocuments(),
          medicinesApi.getMedicines(),
          appointmentsApi.getAppointments(),
          remindersApi.getReminders(),
        ])

        if (!isMounted) return

        // Set live user documents directly (even if items is [] for a new user with 0 uploads)
        if (docsRes.status === 'fulfilled' && Array.isArray(docsRes.value?.items)) {
          setDocuments(docsRes.value.items)
          if (currentUserId) storageService.set(`documents_${currentUserId}`, docsRes.value.items)
        }
        if (medsRes.status === 'fulfilled' && Array.isArray(medsRes.value?.items)) {
          setMedicines(medsRes.value.items)
          if (currentUserId) storageService.set(`medicines_${currentUserId}`, medsRes.value.items)
        }
        if (apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value?.items)) {
          setAppointments(apptsRes.value.items)
          if (currentUserId) storageService.set(`appointments_${currentUserId}`, apptsRes.value.items)
        }
        if (remsRes.status === 'fulfilled' && Array.isArray(remsRes.value?.items)) {
          setReminders(remsRes.value.items)
          if (currentUserId) storageService.set(`reminders_${currentUserId}`, remsRes.value.items)
        }
      } catch (err) {
        console.warn('[HealthDataContext] Live backend synchronization warning:', err)
      } finally {
        if (isMounted) setIsLoadingBackend(false)
      }
    }

    loadBackendData()
    return () => {
      isMounted = false
    }
  }, [auth?.isLiveAuth, currentUserId, setDocuments, setMedicines, setAppointments, setReminders])

  const sortedDocuments = useMemo(() => sortByDateDesc(documents), [documents])
  const stats = useMemo(() => getDocumentStats(documents), [documents])

  const notifications = useMemo(
    () => mockNotifications.map((item) => ({ ...item, read: readNotificationIds.includes(item.id) })),
    [readNotificationIds],
  )

  const registerLocalFile = useCallback((documentId, file) => {
    if (!documentId || typeof File === 'undefined' || !(file instanceof File)) return
    setLocalFiles((current) => ({ ...current, [documentId]: file }))
  }, [])
  const getLocalFile = useCallback((documentId) => localFiles[documentId] ?? null, [localFiles])

  const addDocument = useCallback(
    async (input) => {
      if (auth?.isLiveAuth && input.file) {
        try {
          const created = await documentsApi.uploadDocument(input)
          setDocuments((current) => {
            const next = [created, ...current]
            if (currentUserId) storageService.set(`documents_${currentUserId}`, next)
            return next
          })
          return created
        } catch (err) {
          console.warn('[HealthDataContext] Live upload failed, using fallback:', err)
        }
      }
      const document = {
        id: `doc-${Date.now().toString(36)}`,
        status: 'pending',
        organs: [],
        provider: input.provider || 'Self-uploaded',
        ...input,
      }
      setDocuments((current) => {
        const next = [document, ...current]
        if (currentUserId) storageService.set(`documents_${currentUserId}`, next)
        return next
      })
      return document
    },
    [auth?.isLiveAuth, currentUserId, setDocuments],
  )

  const removeDocument = useCallback(
    async (id) => {
      if (auth?.isLiveAuth) {
        try {
          await documentsApi.deleteDocument(id)
        } catch (err) {
          console.warn('[HealthDataContext] Live delete failed:', err)
        }
      }
      setDocuments((current) => {
        const next = current.filter((doc) => doc.id !== id)
        if (currentUserId) storageService.set(`documents_${currentUserId}`, next)
        return next
      })
      setLocalFiles((current) => {
        if (!(id in current)) return current
        const next = { ...current }
        delete next[id]
        return next
      })
    },
    [auth?.isLiveAuth, currentUserId, setDocuments],
  )

  const addMedicine = useCallback(
    async (input) => {
      if (auth?.isLiveAuth) {
        try {
          const created = await medicinesApi.createMedicine(input)
          setMedicines((current) => [created, ...current])
          return created
        } catch (err) {
          console.warn('[HealthDataContext] Live create medicine error:', err)
        }
      }
      const item = { id: `med-${Date.now().toString(36)}`, status: 'current', ...input }
      setMedicines((current) => [item, ...current])
      return item
    },
    [auth?.isLiveAuth, setMedicines],
  )

  const updateMedicine = useCallback(
    async (id, patch) => {
      if (auth?.isLiveAuth) {
        try {
          await medicinesApi.updateMedicine(id, patch)
        } catch (err) {
          console.warn('[HealthDataContext] Live update medicine error:', err)
        }
      }
      setMedicines((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    [auth?.isLiveAuth, setMedicines],
  )

  const removeMedicine = useCallback(
    async (id) => {
      if (auth?.isLiveAuth) {
        try {
          await medicinesApi.deleteMedicine(id)
        } catch (err) {
          console.warn('[HealthDataContext] Live delete medicine error:', err)
        }
      }
      setMedicines((current) => current.filter((item) => item.id !== id))
    },
    [auth?.isLiveAuth, setMedicines],
  )

  const addAppointment = useCallback(
    async (input) => {
      if (auth?.isLiveAuth) {
        try {
          const created = await appointmentsApi.createAppointment(input)
          setAppointments((current) => [created, ...current])
          return created
        } catch (err) {
          console.warn('[HealthDataContext] Live create appointment error:', err)
        }
      }
      const item = { id: `appt-${Date.now().toString(36)}`, status: 'scheduled', ...input }
      setAppointments((current) => [item, ...current])
      return item
    },
    [auth?.isLiveAuth, setAppointments],
  )

  const updateAppointment = useCallback(
    async (id, patch) => {
      if (auth?.isLiveAuth) {
        try {
          await appointmentsApi.updateAppointment(id, patch)
        } catch (err) {
          console.warn('[HealthDataContext] Live update appointment error:', err)
        }
      }
      setAppointments((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    [auth?.isLiveAuth, setAppointments],
  )

  const removeAppointment = useCallback(
    async (id) => {
      if (auth?.isLiveAuth) {
        try {
          await appointmentsApi.deleteAppointment(id)
        } catch (err) {
          console.warn('[HealthDataContext] Live delete appointment error:', err)
        }
      }
      setAppointments((current) => current.filter((item) => item.id !== id))
    },
    [auth?.isLiveAuth, setAppointments],
  )

  const addReminder = useCallback(
    async (input) => {
      if (auth?.isLiveAuth) {
        try {
          const created = await remindersApi.createReminder(input)
          setReminders((current) => [created, ...current])
          return created
        } catch (err) {
          console.warn('[HealthDataContext] Live create reminder error:', err)
        }
      }
      const item = { id: `rem-${Date.now().toString(36)}`, enabled: true, completed: false, ...input }
      setReminders((current) => [item, ...current])
      return item
    },
    [auth?.isLiveAuth, setReminders],
  )

  const updateReminder = useCallback(
    async (id, patch) => {
      if (auth?.isLiveAuth) {
        try {
          await remindersApi.updateReminder(id, patch)
        } catch (err) {
          console.warn('[HealthDataContext] Live update reminder error:', err)
        }
      }
      setReminders((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    [auth?.isLiveAuth, setReminders],
  )

  const removeReminder = useCallback(
    async (id) => {
      if (auth?.isLiveAuth) {
        try {
          await remindersApi.deleteReminder(id)
        } catch (err) {
          console.warn('[HealthDataContext] Live delete reminder error:', err)
        }
      }
      setReminders((current) => current.filter((item) => item.id !== id))
    },
    [auth?.isLiveAuth, setReminders],
  )

  const markNotificationRead = useCallback(
    (id) => setReadNotificationIds((current) => (current.includes(id) ? current : [...current, id])),
    [setReadNotificationIds],
  )

  const markAllNotificationsRead = useCallback(
    () => setReadNotificationIds(mockNotifications.map((item) => item.id)),
    [setReadNotificationIds],
  )

  const addRecentSearch = useCallback(
    (term) => {
      const value = term.trim()
      if (!value) return
      setRecentSearches((current) => [value, ...current.filter((item) => item !== value)].slice(0, MAX_RECENT_SEARCHES))
    },
    [setRecentSearches],
  )

  const resetDemoData = useCallback(() => {
    storageService.clearAll()
    storageService.set('phase4DocumentMigration', true)
    updateUser(mockUser)
    setDocuments(mockDocuments)
    setMedicines(mockMedicinesData)
    setAppointments(mockAppointmentsData)
    setReminders(mockRemindersData)
    setLocalFiles({})
    setReadNotificationIds([])
    setRecentSearches([])
  }, [updateUser, setDocuments, setMedicines, setAppointments, setReminders, setReadNotificationIds, setRecentSearches])

  const value = useMemo(
    () => ({
      user,
      updateUser,
      registerLocalFile,
      getLocalFile,
      documents: sortedDocuments,
      reports: mockReports,
      medicines,
      appointments,
      reminders,
      addMedicine,
      updateMedicine,
      removeMedicine,
      addAppointment,
      updateAppointment,
      removeAppointment,
      addReminder,
      updateReminder,
      removeReminder,
      stats,
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
      recentSearches,
      addDocument,
      removeDocument,
      markNotificationRead,
      markAllNotificationsRead,
      addRecentSearch,
      resetDemoData,
      isDemoMode: auth?.isDemoMode ?? true,
      isLiveAuth: auth?.isLiveAuth ?? false,
      isLoadingBackend,
    }),
    [
      user,
      updateUser,
      registerLocalFile,
      getLocalFile,
      localFiles,
      sortedDocuments,
      medicines,
      appointments,
      reminders,
      addMedicine,
      updateMedicine,
      removeMedicine,
      addAppointment,
      updateAppointment,
      removeAppointment,
      addReminder,
      updateReminder,
      removeReminder,
      stats,
      notifications,
      recentSearches,
      addDocument,
      removeDocument,
      markNotificationRead,
      markAllNotificationsRead,
      addRecentSearch,
      resetDemoData,
      auth?.isDemoMode,
      auth?.isLiveAuth,
      isLoadingBackend,
    ],
  )

  return <HealthDataContext.Provider value={value}>{children}</HealthDataContext.Provider>
}

export function useHealthData() {
  const context = useContext(HealthDataContext)
  if (!context) throw new Error('useHealthData must be used within a HealthDataProvider')
  return context
}
