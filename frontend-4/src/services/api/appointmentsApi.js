import { apiClient } from './apiClient.js'
import { adaptBackendAppointment, adaptAppointmentForBackend } from '../../utils/adapters.js'

export const appointmentsApi = {
  async getAppointments(params = {}) {
    const raw = await apiClient.get('appointments', { params })
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : []
    return {
      items: items.map(adaptBackendAppointment),
      nextCursor: raw?.nextCursor || null,
      total: raw?.total || items.length,
    }
  },

  async getAppointmentById(id) {
    const raw = await apiClient.get(`appointments/${id}`)
    return adaptBackendAppointment(raw)
  },

  async createAppointment(data) {
    const payload = adaptAppointmentForBackend(data)
    const raw = await apiClient.post('appointments', payload)
    return adaptBackendAppointment(raw)
  },

  async updateAppointment(id, patch) {
    const payload = adaptAppointmentForBackend(patch)
    const raw = await apiClient.patch(`appointments/${id}`, payload)
    return adaptBackendAppointment(raw)
  },

  async deleteAppointment(id) {
    return await apiClient.delete(`appointments/${id}`)
  },
}
