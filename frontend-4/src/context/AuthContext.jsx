import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { env } from '../config/env.js'
import { apiClient, authApi, userApi } from '../services/api/index.js'
import { firebaseAuth } from '../services/auth/firebaseAuth.js'
import { mockUser } from '../data/mockUser.js'
import { storageService } from '../services/storageService.js'
import { setAppLanguage } from '../i18n/index.js'

const AUTH_TOKEN_KEY = 'healthsaathi_auth_token'
const REFRESH_TOKEN_KEY = 'healthsaathi_refresh_token'
const DEMO_MODE_KEY = 'healthsaathi_demo_mode'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => storageService.get(AUTH_TOKEN_KEY, null, (v) => typeof v === 'string'))
  const [refreshToken, setRefreshToken] = useState(() => storageService.get(REFRESH_TOKEN_KEY, null, (v) => typeof v === 'string'))
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [user, setUser] = useState(mockUser)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // Configure apiClient token resolver — always provide valid bearer token
  useEffect(() => {
    apiClient.setTokenGetter(() => token || storageService.get(AUTH_TOKEN_KEY, null) || null)
  }, [token])

  // Listen for 401 Unauthorized from backend & attempt token refresh
  useEffect(() => {
    const unsubscribe = apiClient.onUnauthorized(async () => {
      if (refreshToken && !isDemoMode) {
        try {
          console.info('[AuthContext] Attempting to refresh expired Firebase ID token...')
          const refreshed = await firebaseAuth.refreshToken(refreshToken)
          if (refreshed.idToken) {
            setToken(refreshed.idToken)
            storageService.set(AUTH_TOKEN_KEY, refreshed.idToken)
            if (refreshed.refreshToken) {
              setRefreshToken(refreshed.refreshToken)
              storageService.set(REFRESH_TOKEN_KEY, refreshed.refreshToken)
            }
            return
          }
        } catch (err) {
          console.warn('[AuthContext] Token refresh failed:', err)
        }
      }

      if (!isDemoMode && token) {
        console.warn('[AuthContext] Session expired or unauthorized')
        setAuthError('Your session has expired. Please log in again.')
        setToken(null)
        setRefreshToken(null)
        storageService.remove(AUTH_TOKEN_KEY)
        storageService.remove(REFRESH_TOKEN_KEY)
      }
    })
    return unsubscribe
  }, [isDemoMode, token, refreshToken])

  // Initialize auth: verify token with backend if present, else default to demo or unauthenticated
  useEffect(() => {
    let isMounted = true

    async function initAuth() {
      setIsLoading(true)
      if (token && !isDemoMode) {
        try {
          const profile = await userApi.getProfile()
          if (isMounted && profile) {
            const cached = storageService.get('profile', null)
            const resolved = {
              ...cached,
              ...profile,
              avatar: profile.avatar || cached?.avatar || '',
              photoUrl: profile.avatar || cached?.avatar || '',
              displayName: profile.displayName || cached?.displayName || '',
              fullName: profile.fullName || cached?.fullName || profile.displayName || '',
              firstName: profile.firstName || cached?.firstName || (profile.displayName ? profile.displayName.split(' ')[0] : 'User'),
            }
            setUser(resolved)
            storageService.set('profile', resolved)
            const lang = resolved.preferences?.language || resolved.preferences?.preferredLanguage || 'en'
            setAppLanguage(lang)
          }
        } catch (err) {
          console.warn('[AuthContext] Failed to validate token with backend:', err.message)
          if (isMounted) {
            if (refreshToken) {
              try {
                const refreshed = await firebaseAuth.refreshToken(refreshToken)
                if (refreshed.idToken) {
                  setToken(refreshed.idToken)
                  storageService.set(AUTH_TOKEN_KEY, refreshed.idToken)
                  const profile = await userApi.getProfile()
                  if (profile) {
                    const cached = storageService.get('profile', null)
                    const resolved = {
                      ...cached,
                      ...profile,
                      avatar: profile.avatar || cached?.avatar || '',
                      photoUrl: profile.avatar || cached?.avatar || '',
                      displayName: profile.displayName || cached?.displayName || '',
                      fullName: profile.fullName || cached?.fullName || profile.displayName || '',
                      firstName: profile.firstName || cached?.firstName || (profile.displayName ? profile.displayName.split(' ')[0] : 'User'),
                    }
                    setUser(resolved)
                    storageService.set('profile', resolved)
                    const lang = resolved.preferences?.language || resolved.preferences?.preferredLanguage || 'en'
                    setAppLanguage(lang)
                  }
                  setIsLoading(false)
                  return
                }
              } catch (refreshErr) {
                console.warn('[AuthContext] Initial refresh failed:', refreshErr)
              }
            }

            if (env.enableMockFallback) {
              console.info('[AuthContext] Backend unavailable; enabling demo mode fallback.')
              setIsDemoMode(true)
              setUser(storageService.get('profile', mockUser))
            } else {
              setToken(null)
              storageService.remove(AUTH_TOKEN_KEY)
              setAuthError('Authentication session expired or invalid.')
            }
          }
        }
      } else if (isDemoMode) {
        const savedDemoProfile = storageService.get('profile', mockUser)
        if (isMounted) setUser(savedDemoProfile)
      }

      if (isMounted) setIsLoading(false)
    }

    initAuth()
    return () => {
      isMounted = false
    }
  }, [token, isDemoMode, refreshToken])

  const setAuthTokens = useCallback((newToken, newRefreshToken = null) => {
    setToken(newToken)
    if (newToken) {
      storageService.set(AUTH_TOKEN_KEY, newToken)
      setIsDemoMode(false)
      storageService.set(DEMO_MODE_KEY, false)
    } else {
      storageService.remove(AUTH_TOKEN_KEY)
    }

    if (newRefreshToken) {
      setRefreshToken(newRefreshToken)
      storageService.set(REFRESH_TOKEN_KEY, newRefreshToken)
    } else if (!newToken) {
      setRefreshToken(null)
      storageService.remove(REFRESH_TOKEN_KEY)
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setAuthError(null)

    // Live Firebase Authentication
    try {
      const fbUser = await firebaseAuth.signInWithEmailAndPassword(email, password)
      setAuthTokens(fbUser.idToken, fbUser.refreshToken)

      // Fetch or upsert profile in MongoDB backend via /api/v1/me
      const profile = await userApi.getProfile()
      const mergedUser = {
        ...profile,
        email: fbUser.email || profile.email,
        displayName: fbUser.displayName || profile.displayName,
      }
      setUser(mergedUser)
      storageService.set('profile', mergedUser)
      setIsDemoMode(false)
      storageService.set(DEMO_MODE_KEY, false)

      const lang = mergedUser.preferences?.language || mergedUser.preferences?.preferredLanguage || 'en'
      setAppLanguage(lang)

      await authApi.logAuthEvent('login', { mode: 'firebase', email })
      return { success: true, user: mergedUser, mode: 'live' }
    } catch (err) {
      setAuthError(err.message || 'Login failed')
      throw err
    }
  }, [setAuthTokens])

  const register = useCallback(async ({ name, email, password }) => {
    setAuthError(null)

    // Live Firebase Registration
    try {
      const fullName = (name || '').trim().replace(/\s+/g, ' ')
      const fbUser = await firebaseAuth.createUserWithEmailAndPassword(email, password, fullName)
      setAuthTokens(fbUser.idToken, fbUser.refreshToken)

      // Upsert profile in backend MongoDB
      const profile = await userApi.getProfile()
      const mergedUser = {
        ...profile,
        displayName: fullName || fbUser.displayName || profile.displayName,
        email: fbUser.email || profile.email,
      }
      // Update display name in MongoDB backend if not already saved
      if (fullName && (!profile.displayName || profile.displayName !== fullName)) {
        await userApi.updateProfile({ displayName: fullName })
      }

      setUser(mergedUser)
      storageService.set('profile', mergedUser)
      setIsDemoMode(false)
      storageService.set(DEMO_MODE_KEY, false)

      const lang = mergedUser.preferences?.language || mergedUser.preferences?.preferredLanguage || 'en'
      setAppLanguage(lang)

      await authApi.logAuthEvent('register', { mode: 'firebase', email })
      return { success: true, user: mergedUser, mode: 'live' }
    } catch (err) {
      setAuthError(err.message || 'Registration failed')
      throw err
    }
  }, [setAuthTokens])

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null)
    try {
      const fbUser = await firebaseAuth.promptGoogleSignIn()
      setAuthTokens(fbUser.idToken, fbUser.refreshToken)

      let profile = null
      try {
        profile = await userApi.getProfile()
      } catch (profileErr) {
        console.warn('[AuthContext] Backend profile fetch warning on Google sign-in:', profileErr)
      }

      const fullName = fbUser.displayName || fbUser.fullName || profile?.displayName || ''
      const avatar = fbUser.avatar || fbUser.photoUrl || profile?.avatar || ''
      const firstName = fbUser.firstName || (fullName ? fullName.split(' ')[0] : 'User')

      const mergedUser = {
        ...profile,
        email: fbUser.email || profile?.email,
        displayName: fullName,
        fullName: fullName,
        firstName: firstName,
        avatar: avatar,
        photoUrl: avatar,
      }

      setUser(mergedUser)
      storageService.set('profile', mergedUser)
      setIsDemoMode(false)
      storageService.set(DEMO_MODE_KEY, false)

      const lang = mergedUser.preferences?.language || mergedUser.preferences?.preferredLanguage || 'en'
      setAppLanguage(lang)

      // Sync avatar and display name to backend profile
      if (avatar || fullName) {
        try {
          await userApi.updateProfile({
            displayName: fullName,
            fullName: fullName,
            avatar: avatar,
          })
        } catch (syncErr) {
          console.warn('[AuthContext] Backend profile sync warning:', syncErr)
        }
      }

      await authApi.logAuthEvent('login', { mode: 'google', email: fbUser.email })
      return { success: true, user: mergedUser, mode: 'live' }
    } catch (err) {
      setAuthError(err.message || 'Google sign-in failed')
      throw err
    }
  }, [setAuthTokens])

  const resetPassword = useCallback(async (email) => {
    try {
      return await firebaseAuth.sendPasswordResetEmail(email)
    } catch (err) {
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logAuthEvent('logout', { mode: isDemoMode ? 'demo' : 'live' })
    } catch {
      // ignore
    }
    const uid = user?.uid || user?.id || user?.email
    setToken(null)
    setRefreshToken(null)
    storageService.remove(AUTH_TOKEN_KEY)
    storageService.remove(REFRESH_TOKEN_KEY)
    storageService.remove('profile')
    storageService.remove('documents')
    storageService.remove('medicines')
    storageService.remove('appointments')
    storageService.remove('reminders')
    storageService.remove('healthsaathi_preferred_language')
    setAppLanguage('en')
    if (uid) {
      storageService.remove(`documents_${uid}`)
      storageService.remove(`medicines_${uid}`)
      storageService.remove(`appointments_${uid}`)
      storageService.remove(`reminders_${uid}`)
      storageService.remove(`healthsaathi_has_selected_language_${uid}`)
    }
    setUser(mockUser)
    setAuthError(null)
  }, [isDemoMode, user])

  const updateProfile = useCallback(async (patch) => {
    setUser((current) => ({ ...current, ...patch }))
    storageService.set('profile', { ...user, ...patch })

    const changedLang = patch.preferences?.language || patch.preferences?.preferredLanguage || patch.preferredLanguage
    if (changedLang) {
      setAppLanguage(changedLang)
    }

    if (token && !isDemoMode) {
      try {
        const updated = await userApi.updateProfile(patch)
        if (updated) {
          const merged = { ...user, ...patch, ...updated }
          setUser(merged)
          storageService.set('profile', merged)
          const updatedLang = merged.preferences?.language || merged.preferences?.preferredLanguage
          if (updatedLang) setAppLanguage(updatedLang)
          return merged
        }
      } catch (err) {
        console.warn('[AuthContext] Backend profile update failed, kept local state:', err)
      }
    }
  }, [token, isDemoMode, user])

  const toggleDemoMode = useCallback((forcedMode) => {
    const nextMode = typeof forcedMode === 'boolean' ? forcedMode : !isDemoMode
    setIsDemoMode(nextMode)
    storageService.set(DEMO_MODE_KEY, nextMode)
  }, [isDemoMode])

  const value = useMemo(() => ({
    user,
    token,
    refreshToken,
    isAuthenticated: Boolean(token || isDemoMode),
    isLiveAuth: Boolean(token && !isDemoMode),
    isDemoMode,
    isLoading,
    authError,
    login,
    loginWithGoogle,
    register,
    resetPassword,
    logout,
    updateProfile,
    setAuthTokens,
    toggleDemoMode,
    clearAuthError: () => setAuthError(null),
  }), [
    user,
    token,
    refreshToken,
    isDemoMode,
    isLoading,
    authError,
    login,
    loginWithGoogle,
    register,
    resetPassword,
    logout,
    updateProfile,
    setAuthTokens,
    toggleDemoMode,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
