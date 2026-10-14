import { env } from '../../config/env.js'

const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1/accounts'
const SECURE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token'

const ERROR_MESSAGES = {
  EMAIL_NOT_FOUND: 'No account found with this email address.',
  INVALID_PASSWORD: 'The password entered is incorrect.',
  USER_DISABLED: 'This account has been disabled.',
  EMAIL_EXISTS: 'An account with this email address already exists.',
  OPERATION_NOT_ALLOWED: 'Password sign-in is not enabled for this Firebase project.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Access to this account has been temporarily disabled due to many failed login attempts. Try again later.',
  INVALID_LOGIN_CREDENTIALS: 'Invalid email or password.',
  WEAK_PASSWORD: 'The password is too weak. Please use at least 6 characters.',
}

class FirebaseAuthClient {
  constructor() {
    this.apiKey = env.firebase.apiKey
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.apiKey !== '')
  }

  async _post(url, body) {
    if (!this.isConfigured) {
      throw new Error('Firebase API Key is not configured in environment variables.')
    }

    const response = await fetch(`${url}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (!response.ok) {
      const code = data?.error?.message || 'UNKNOWN_AUTH_ERROR'
      const readable = ERROR_MESSAGES[code] || data?.error?.message || 'Authentication request failed'
      const error = new Error(readable)
      error.code = code
      error.details = data?.error
      throw error
    }

    return data
  }

  /**
   * Sign in user with email and password
   */
  async signInWithEmailAndPassword(email, password) {
    const res = await this._post(`${IDENTITY_TOOLKIT_URL}:signInWithPassword`, {
      email,
      password,
      returnSecureToken: true,
    })

    return {
      uid: res.localId,
      email: res.email,
      displayName: res.displayName || '',
      idToken: res.idToken,
      refreshToken: res.refreshToken,
      expiresIn: res.expiresIn,
    }
  }

  /**
   * Register new user with email, password, and optional displayName
   */
  async createUserWithEmailAndPassword(email, password, displayName = '') {
    const res = await this._post(`${IDENTITY_TOOLKIT_URL}:signUp`, {
      email,
      password,
      returnSecureToken: true,
    })

    let user = {
      uid: res.localId,
      email: res.email,
      displayName: displayName || '',
      idToken: res.idToken,
      refreshToken: res.refreshToken,
      expiresIn: res.expiresIn,
    }

    if (displayName) {
      try {
        const updateRes = await this.updateProfile(res.idToken, displayName)
        user.displayName = updateRes.displayName || displayName
        user.idToken = updateRes.idToken || user.idToken
      } catch (err) {
        console.warn('[FirebaseAuthClient] Failed to set initial displayName:', err)
      }
    }

    return user
  }

  /**
   * Update displayName or photoUrl
   */
  async updateProfile(idToken, displayName) {
    return await this._post(`${IDENTITY_TOOLKIT_URL}:update`, {
      idToken,
      displayName,
      returnSecureToken: true,
    })
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email) {
    return await this._post(`${IDENTITY_TOOLKIT_URL}:sendOobCode`, {
      requestType: 'PASSWORD_RESET',
      email,
    })
  }

  /**
   * Refresh expired ID token using refresh token
   */
  async refreshToken(refreshToken) {
    const response = await fetch(`${SECURE_TOKEN_URL}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Failed to refresh token')
    }

    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      userId: data.user_id,
    }
  }

  /**
   * Sign in with external Identity Provider (Google, etc.)
   */
  async signInWithIdp({ idToken, accessToken, providerId = 'google.com' }) {
    if (!idToken && !accessToken) {
      throw new Error('Google credential (idToken or accessToken) is required for sign-in')
    }

    let postBody = `providerId=${encodeURIComponent(providerId)}`
    if (idToken) {
      postBody += `&id_token=${encodeURIComponent(idToken)}`
    }
    if (accessToken) {
      postBody += `&access_token=${encodeURIComponent(accessToken)}`
    }

    const requestUri = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

    const res = await this._post(`${IDENTITY_TOOLKIT_URL}:signInWithIdp`, {
      postBody,
      requestUri,
      returnSecureToken: true,
      returnIdpCredential: true,
    })

    let avatar = res.photoUrl || ''
    let displayName = res.displayName || ''
    let firstName = res.firstName || ''

    if (res.rawUserInfo) {
      try {
        const raw = typeof res.rawUserInfo === 'string' ? JSON.parse(res.rawUserInfo) : res.rawUserInfo
        if (!avatar && raw?.picture) avatar = raw.picture
        if (!displayName && raw?.name) displayName = raw.name
        if (!firstName && raw?.given_name) firstName = raw.given_name
      } catch {
        // ignore parse error
      }
    }

    return {
      uid: res.localId,
      email: res.email,
      displayName: displayName || '',
      fullName: displayName || '',
      firstName: firstName || (displayName ? displayName.split(' ')[0] : 'User'),
      avatar: avatar,
      photoUrl: avatar,
      idToken: res.idToken,
      refreshToken: res.refreshToken,
      expiresIn: res.expiresIn,
    }
  }

  /**
   * Launch Google Sign-In prompt or popup via Google Identity Services
   */
  async promptGoogleSignIn(customClientId = null) {
    if (typeof window === 'undefined') {
      throw new Error('Google sign-in is only available in a browser environment')
    }

    const clientId = customClientId || env.firebase.googleClientId

    if (!clientId) {
      throw new Error(
        'Google OAuth Client ID is not configured. To enable live Google sign-in, add VITE_GOOGLE_CLIENT_ID to frontend-4/.env and enable Google sign-in in your Firebase Console.'
      )
    }

    // Ensure Google Identity Services script is available
    if (!window.google?.accounts?.oauth2) {
      await new Promise((resolve, reject) => {
        const existing = document.getElementById('google-gsi-client')
        if (existing) {
          existing.addEventListener('load', resolve)
          existing.addEventListener('error', reject)
          return
        }
        const script = document.createElement('script')
        script.id = 'google-gsi-client'
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = resolve
        script.onerror = () => reject(new Error('Failed to load Google Sign-In script. Check network connectivity or ad blockers.'))
        document.head.appendChild(script)
      })
    }

    return new Promise((resolve, reject) => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'access_denied') {
                return reject(new Error('Google sign-in was cancelled by user.'))
              }
              return reject(new Error(`Google sign-in error: ${tokenResponse.error}`))
            }
            try {
              let googleUser = null
              if (tokenResponse.access_token) {
                try {
                  const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                  })
                  if (gRes.ok) {
                    googleUser = await gRes.json()
                  }
                } catch (gErr) {
                  console.warn('[FirebaseAuth] Google userinfo fetch warning:', gErr)
                }
              }

              const user = await this.signInWithIdp({
                accessToken: tokenResponse.access_token,
                providerId: 'google.com',
              })

              const photo = user.avatar || user.photoUrl || googleUser?.picture || ''
              const name = user.displayName || googleUser?.name || ''
              const first = googleUser?.given_name || user.firstName || (name ? name.split(' ')[0] : 'User')

              resolve({
                ...user,
                displayName: name || user.displayName,
                fullName: name || user.displayName,
                firstName: first,
                avatar: photo,
                photoUrl: photo,
              })
            } catch (err) {
              reject(err)
            }
          },
          error_callback: (err) => {
            reject(new Error(err?.message || 'Google Sign-In window closed or blocked.'))
          },
        })

        client.requestAccessToken({ prompt: 'consent' })
      } catch (err) {
        reject(err)
      }
    })
  }
}

export const firebaseAuth = new FirebaseAuthClient()
