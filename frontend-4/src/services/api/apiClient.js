import { env } from '../../config/env.js'

export class ApiError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null, requestId = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

// Token storage key
const TOKEN_KEY = 'healthsaathi_auth_token'

class ApiClient {
  constructor(baseUrl = env.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.tokenGetter = () => {
      try {
        return localStorage.getItem(TOKEN_KEY) || null
      } catch {
        return null
      }
    }
    this.unauthorizedHandlers = new Set()
  }

  setTokenGetter(fn) {
    this.tokenGetter = fn
  }

  onUnauthorized(callback) {
    this.unauthorizedHandlers.add(callback)
    return () => this.unauthorizedHandlers.delete(callback)
  }

  notifyUnauthorized() {
    this.unauthorizedHandlers.forEach((handler) => {
      try {
        handler()
      } catch (err) {
        console.error('[ApiClient] Error in unauthorized handler:', err)
      }
    })
  }

  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body,
      params,
      timeout = 30000,
      skipAuth = false,
      ...customOptions
    } = options

    let url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`

    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `${url.includes('?') ? '&' : '?'}${queryString}`
      }
    }

    const requestHeaders = new Headers(headers)

    // Set request ID for end-to-end tracing
    if (!requestHeaders.has('x-request-id')) {
      const randomId = Math.random().toString(36).substring(2, 10)
      requestHeaders.set('x-request-id', `req_fe_${Date.now()}_${randomId}`)
    }

    // Attach Bearer token if available and not skipped
    if (!skipAuth && !requestHeaders.has('Authorization')) {
      let token = typeof this.tokenGetter === 'function' ? this.tokenGetter() : null
      if (!token) {
        try {
          token = localStorage.getItem(TOKEN_KEY) || null
        } catch {
          token = null
        }
      }
      if (token) {
        requestHeaders.set('Authorization', `Bearer ${token}`)
      }
    }

    // Auto set JSON content-type if body is an object and not FormData
    let requestBody = body
    if (body && !(body instanceof FormData) && !(body instanceof Blob) && typeof body === 'object') {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json')
      }
      requestBody = JSON.stringify(body)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
        ...customOptions,
      })

      clearTimeout(timer)

      // Handle 204 No Content
      if (response.status === 204) {
        return null
      }

      const requestId = response.headers.get('x-request-id')
      let json = null
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        try {
          json = await response.json()
        } catch {
          json = null
        }
      }

      if (!response.ok) {
        if (response.status === 401) {
          this.notifyUnauthorized()
        }

        const errorCode = json?.error?.code || `HTTP_${response.status}`
        let errorMessage = json?.error?.message

        if (!errorMessage) {
          if (response.status === 404) {
            errorMessage = 'The requested medical record or resource could not be found.'
          } else if (response.status === 429) {
            errorMessage = 'Request limit reached. Please wait a moment before trying again.'
          } else if (response.status === 503) {
            errorMessage = 'The service is temporarily undergoing maintenance or high traffic. Please try again in a few moments.'
          } else if (response.status >= 500) {
            errorMessage = 'Our server encountered a temporary issue. Please try again shortly.'
          } else {
            errorMessage = response.statusText || 'An unexpected error occurred. Please try again.'
          }
        }

        const details = json?.error?.details || json?.error || null

        throw new ApiError(errorMessage, response.status, errorCode, details, requestId)
      }

      // Backend wraps payload in { data, meta }
      return json?.data !== undefined ? json.data : json
    } catch (err) {
      clearTimeout(timer)
      if (err.name === 'AbortError') {
        throw new ApiError(
          'The request took longer than expected. Please check your connection and try again.',
          408,
          'REQUEST_TIMEOUT'
        )
      }
      if (err instanceof ApiError) {
        throw err
      }
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
      const networkMsg = isOffline
        ? 'You appear to be offline. Please check your internet connection and try again.'
        : 'Unable to connect to HealthSaathi servers. Please verify your connection or try again shortly.'
      throw new ApiError(networkMsg, 0, 'NETWORK_ERROR')
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' })
  }

  post(endpoint, data, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body: data })
  }

  patch(endpoint, data, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body: data })
  }

  put(endpoint, data, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body: data })
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' })
  }

  upload(endpoint, formData, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
    })
  }
}

export const apiClient = new ApiClient()
