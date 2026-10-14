import { apiClient } from './apiClient.js'
import { adaptBackendUser, adaptUserForBackend } from '../../utils/adapters.js'

export const userApi = {
  /**
   * Get current authenticated user's profile from /me
   */
  async getProfile() {
    const raw = await apiClient.get('me')
    return adaptBackendUser(raw)
  },

  /**
   * Update profile fields (displayName, phone, dateOfBirth, preferences)
   */
  async updateProfile(updates) {
    const backendPayload = adaptUserForBackend(updates)
    const raw = await apiClient.patch('me', backendPayload)
    return adaptBackendUser(raw)
  },

  /**
   * Get user preferences (language, notifications, accessibility)
   */
  async getPreferences() {
    return await apiClient.get('users/me/preferences')
  },

  /**
   * Update user preferences
   */
  async updatePreferences(preferences) {
    return await apiClient.patch('users/me/preferences', preferences)
  },

  /**
   * Request account deletion
   */
  async deleteAccount() {
    return await apiClient.post('me/delete', {})
  },
}
