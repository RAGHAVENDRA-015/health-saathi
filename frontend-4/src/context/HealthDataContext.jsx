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

  const currentUserId = auth?.isLiveAuth ? (auth?.user?.uid || auth?.user?.id || auth?.user?.email || null) : null

  const [localUser, setLocalUser] = usePersistentState('profile', mockUser, isValidUser)
  const user = useMemo(() => {
    if (auth?.user) return auth.user
    if (auth?.isLiveAuth) {
      return {
        id: currentUserId || 'user',
        firstName: 'User',
        displayName: 'User',
        fullName: 'User',
        email: '',
      }
    }
    return localUser || mockUser
  }, [auth?.user, auth?.isLiveAuth, currentUserId, localUser])

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

  // Scoped documents state:
  // If authenticated user: NEVER load mockDocuments! Load from documents_${currentUserId} or default to []
  // If demo mode: load from documents_demo or mockDocuments
  const [documents, setDocuments] = useState(() => {
    if (auth?.isLiveAuth && currentUserId) {
      return storageService.get(`documents_${currentUserId}`, [])
    }
    if (auth?.isDemoMode) {
      return storageService.get('documents_demo', mockDocuments)
    }
    return []
  })

  const [medicines, setMedicines] = useState(() => {
    if (auth?.isLiveAuth && currentUserId) {
      return storageService.get(`medicines_${currentUserId}`, [])
    }
    if (auth?.isDemoMode) {
      return storageService.get('medicines_demo', mockMedicinesData)
    }
    return []
  })

  const [appointments, setAppointments] = useState(() => {
    if (auth?.isLiveAuth && currentUserId) {
      return storageService.get(`appointments_${currentUserId}`, [])
    }
    if (auth?.isDemoMode) {
      return storageService.get('appointments_demo', mockAppointmentsData)
    }
    return []
  })

  const [reminders, setReminders] = useState(() => {
    if (auth?.isLiveAuth && currentUserId) {
      return storageService.get(`reminders_${currentUserId}`, [])
    }
    if (auth?.isDemoMode) {
      return storageService.get('reminders_demo', mockRemindersData)
    }
    return []
  })

  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    if (currentUserId) {
      return storageService.get(`readNotifications_${currentUserId}`, [])
    }
    return []
  })

  const [recentSearches, setRecentSearches] = useState(() => {
    if (currentUserId) {
      return storageService.get(`recentSearches_${currentUserId}`, [])
    }
    return []
  })

  const [isLoadingBackend, setIsLoadingBackend] = useState(false)

  // 1. Purge legacy un-scoped clinical data from localStorage to prevent cross-account leak
  useEffect(() => {
    if (auth?.isLiveAuth) {
      storageService.remove('documents')
      storageService.remove('medicines')
      storageService.remove('appointments')
      storageService.remove('reminders')
      storageService.remove('readNotifications')
      storageService.remove('recentSearches')
      storageService.remove('phase4DocumentMigration')
    }
  }, [auth?.isLiveAuth])

  // 2. One-time migration strictly for demo mode users (never for live authenticated users)
  useEffect(() => {
    if (auth?.isLiveAuth || !auth?.isDemoMode) return
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
      const merged = [...newlySeededDocs, ...migrated]
      storageService.set('documents_demo', merged)
      return merged
    })
    storageService.set('phase4DocumentMigration', true)
  }, [auth?.isLiveAuth, auth?.isDemoMode])

  // 3. User switch isolation: wipe or restore scoped user data whenever active user identity changes or on mount
  const prevUserIdRef = useRef(null)

  useEffect(() => {
    if (prevUserIdRef.current !== currentUserId) {
      prevUserIdRef.current = currentUserId
      if (currentUserId) {
        // Scoped cache for this specific user - User A gets User A data, User B gets User B data
        const cachedDocs = storageService.get(`documents_${currentUserId}`, [])
        const cachedMeds = storageService.get(`medicines_${currentUserId}`, [])
        const cachedAppts = storageService.get(`appointments_${currentUserId}`, [])
        const cachedRems = storageService.get(`reminders_${currentUserId}`, [])
        const cachedReads = storageService.get(`readNotifications_${currentUserId}`, [])
        const cachedSearches = storageService.get(`recentSearches_${currentUserId}`, [])
        setDocuments(cachedDocs)
        setMedicines(cachedMeds)
        setAppointments(cachedAppts)
        setReminders(cachedRems)
        setReadNotificationIds(cachedReads)
        setRecentSearches(cachedSearches)
        setLocalFiles({})
      } else {
        // Logged out / unauthenticated: return to demo baseline if in demo mode, else blank
        if (auth?.isDemoMode) {
          setDocuments(storageService.get('documents_demo', mockDocuments))
          setMedicines(storageService.get('medicines_demo', mockMedicinesData))
          setAppointments(storageService.get('appointments_demo', mockAppointmentsData))
          setReminders(storageService.get('reminders_demo', mockRemindersData))
        } else {
          setDocuments([])
          setMedicines([])
          setAppointments([])
          setReminders([])
        }
        setReadNotificationIds([])
        setRecentSearches([])
        setLocalFiles({})
      }
    }
  }, [currentUserId, auth?.isDemoMode])

  // 4. Synchronize live data when authenticated with backend
  useEffect(() => {
    if (!auth?.isLiveAuth || !currentUserId) return

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
          storageService.set(`documents_${currentUserId}`, docsRes.value.items)
        }
        if (medsRes.status === 'fulfilled' && Array.isArray(medsRes.value?.items)) {
          setMedicines(medsRes.value.items)
          storageService.set(`medicines_${currentUserId}`, medsRes.value.items)
        }
        if (apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value?.items)) {
          setAppointments(apptsRes.value.items)
          storageService.set(`appointments_${currentUserId}`, apptsRes.value.items)
        }
        if (remsRes.status === 'fulfilled' && Array.isArray(remsRes.value?.items)) {
          setReminders(remsRes.value.items)
          storageService.set(`reminders_${currentUserId}`, remsRes.value.items)
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
  }, [auth?.isLiveAuth, currentUserId])

  const sortedDocuments = useMemo(() => sortByDateDesc(documents), [documents])
  const stats = useMemo(() => getDocumentStats(documents), [documents])

  const reports = useMemo(() => {
    if (auth?.isLiveAuth) {
      return []
    }
    return mockReports
  }, [auth?.isLiveAuth])

  const notifications = useMemo(() => {
    if (auth?.isLiveAuth) {
      return []
    }
    return mockNotifications.map((item) => ({ ...item, read: readNotificationIds.includes(item.id) }))
  }, [auth?.isLiveAuth, readNotificationIds])

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
        if (currentUserId) {
          storageService.set(`documents_${currentUserId}`, next)
        } else if (auth?.isDemoMode) {
          storageService.set('documents_demo', next)
        }
        return next
      })
      return document
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
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
        const next = current.filter((doc) => doc.id !== id && doc._id !== id)
        if (currentUserId) {
          storageService.set(`documents_${currentUserId}`, next)
        } else if (auth?.isDemoMode) {
          storageService.set('documents_demo', next)
        }
        return next
      })
      setLocalFiles((current) => {
        if (!(id in current)) return current
        const next = { ...current }
        delete next[id]
        return next
      })
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
  )

  const addMedicine = useCallback(
    async (input) => {
      let created = null
      if (auth?.isLiveAuth) {
        try {
          created = await medicinesApi.createMedicine(input)
        } catch (err) {
          console.warn('[HealthDataContext] Live create medicine error:', err)
        }
      }
      const item = created || { id: `med-${Date.now().toString(36)}`, status: 'current', ...input }
      setMedicines((current) => {
        const next = [item, ...current]
        if (currentUserId) storageService.set(`medicines_${currentUserId}`, next)
        else if (auth?.isDemoMode) storageService.set('medicines_demo', next)
        return next
      })
      return item
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
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
      setMedicines((current) => {
        const next = current.map((item) => (item.id === id || item._id === id ? { ...item, ...patch } : item))
        if (currentUserId) storageService.set(`medicines_${currentUserId}`, next)
        else if (auth?.isDemoMode) storageService.set('medicines_demo', next)
        return next
      })
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
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
      setMedicines((current) => {
        const next = current.filter((item) => item.id !== id && item._id !== id)
        if (currentUserId) storageService.set(`medicines_${currentUserId}`, next)
        else if (auth?.isDemoMode) storageService.set('medicines_demo', next)
        return next
      })
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
  )

  const addAppointment = useCallback(
    async (input) => {
      let created = null
      if (auth?.isLiveAuth) {
        try {
          created = await appointmentsApi.createAppointment(input)
        } catch (err) {
          console.warn('[HealthDataContext] Live create appointment error:', err)
        }
      }
      const item = created || { id: `appt-${Date.now().toString(36)}`, status: 'scheduled', ...input }
      setAppointments((current) => {
        const next = [item, ...current]
        if (currentUserId) storageService.set(`appointments_${currentUserId}`, next)
        else if (auth?.isDemoMode) storageService.set('appointments_demo', next)
        return next
      })
      return item
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
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
      setAppointments((current) => {
        const next = current.map((item) => (item.id === id || item._id === id ? { ...item, ...patch } : item))
        if (currentUserId) storageService.set(`appointments_${currentUserId}`, next)
        else if (auth?.isDemoMode) storageService.set('appointments_demo', next)
        return next
      })
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
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
      setAppointments((current) => {
        const next = current.filter((item) => item.id !== id && item._id !== id)
        if (currentUserId) storageService.set(`appointments_${currentUserId}`, next)
        else if (auth?.isDemoMode) storageService.set('appointments_demo', next)
        return next
      })
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
  )

  const addReminder = useCallback(
    async (input) => {
      let created = null
      if (auth?.isLiveAuth) {
        try {
          created = await remindersApi.createReminder(input)
        } catch (err) {
          console.warn('[HealthDataContext] Live create reminder error:', err)
        }
      }
      const item = created || { id: `rem-${Date.now().toString(36)}`, enabled: true, completed: false, ...input }
      setReminders((current) => {
        const next = [item, ...current]
        if (currentUserId) storageService.set(`reminders_${currentUserId}`, next)
        else if (auth?.isDemoMode) storageService.set('reminders_demo', next)
        return next
      })
      return item
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
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
      setReminders((current) => {
        const next = current.map((item) => (item.id === id || item._id === id ? { ...item, ...patch } : item))
        if (currentUserId) storageService.set(`reminders_${currentUserId}`, next)
        else if (auth?.isDemoMode) storageService.set('reminders_demo', next)
        return next
      })
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
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
      setReminders((current) => {
        const next = current.filter((item) => item.id !== id && item._id !== id)
        if (currentUserId) storageService.set(`reminders_${currentUserId}`, next)
        else if (auth?.isDemoMode) storageService.set('reminders_demo', next)
        return next
      })
    },
    [auth?.isLiveAuth, auth?.isDemoMode, currentUserId],
  )

  const markNotificationRead = useCallback(
    (id) =>
      setReadNotificationIds((current) => {
        const next = current.includes(id) ? current : [...current, id]
        if (currentUserId) storageService.set(`readNotifications_${currentUserId}`, next)
        return next
      }),
    [currentUserId],
  )

  const markAllNotificationsRead = useCallback(() => {
    const allIds = notifications.map((item) => item.id)
    setReadNotificationIds(allIds)
    if (currentUserId) storageService.set(`readNotifications_${currentUserId}`, allIds)
  }, [currentUserId, notifications])

  const addRecentSearch = useCallback(
    (term) => {
      const value = term.trim()
      if (!value) return
      setRecentSearches((current) => {
        const next = [value, ...current.filter((item) => item !== value)].slice(0, MAX_RECENT_SEARCHES)
        if (currentUserId) storageService.set(`recentSearches_${currentUserId}`, next)
        return next
      })
    },
    [currentUserId],
  )

  const resetDemoData = useCallback(() => {
    if (auth?.isLiveAuth) return
    storageService.remove('documents_demo')
    storageService.remove('medicines_demo')
    storageService.remove('appointments_demo')
    storageService.remove('reminders_demo')
    storageService.set('phase4DocumentMigration', true)
    updateUser(mockUser)
    setDocuments(mockDocuments)
    setMedicines(mockMedicinesData)
    setAppointments(mockAppointmentsData)
    setReminders(mockRemindersData)
    setLocalFiles({})
    setReadNotificationIds([])
    setRecentSearches([])
  }, [auth?.isLiveAuth, updateUser])

  const value = useMemo(
    () => ({
      user,
      updateUser,
      registerLocalFile,
      getLocalFile,
      documents: sortedDocuments,
      reports,
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
      reports,
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
