import { apiClient } from './apiClient.js'
import { adaptBackendReminder, adaptReminderForBackend } from '../../utils/adapters.js'

export const remindersApi = {
  async getReminders(params = {}) {
    const raw = await apiClient.get('reminders', { params })
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : []
    return {
      items: items.map(adaptBackendReminder),
      nextCursor: raw?.nextCursor || null,
      total: raw?.total || items.length,
    }
  },

  async getReminderById(id) {
    const raw = await apiClient.get(`reminders/${id}`)
    return adaptBackendReminder(raw)
  },

  async createReminder(data) {
    const payload = adaptReminderForBackend(data)
    const raw = await apiClient.post('reminders', payload)
    return adaptBackendReminder(raw)
  },

  async updateReminder(id, patch) {
    const payload = adaptReminderForBackend(patch)
    const raw = await apiClient.patch(`reminders/${id}`, payload)
    return adaptBackendReminder(raw)
  },

  async markComplete(id) {
    const raw = await apiClient.post(`reminders/${id}/complete`, {})
    return adaptBackendReminder(raw)
  },

  async deleteReminder(id) {
    return await apiClient.delete(`reminders/${id}`)
  },
}
