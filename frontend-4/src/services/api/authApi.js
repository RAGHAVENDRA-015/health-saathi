import { apiClient } from './apiClient.js'

export const authApi = {
  /**
   * Record auth lifecycle events into the immutable backend audit log
   * @param {'login'|'logout'|'register'|'token_refresh'} event
   * @param {Record<string, unknown>} metadata
   */
  async logAuthEvent(event, metadata = {}) {
    try {
      return await apiClient.post('auth/events', { event, metadata }, { skipAuth: false })
    } catch (err) {
      // Audit log errors shouldn't crash the client app
      console.warn('[authApi] Failed to log auth event:', err)
      return null
    }
  },
}
