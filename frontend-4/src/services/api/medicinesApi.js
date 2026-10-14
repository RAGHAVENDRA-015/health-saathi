import { apiClient } from './apiClient.js'
import { adaptBackendMedicine, adaptMedicineForBackend } from '../../utils/adapters.js'

export const medicinesApi = {
  async getMedicines(params = {}) {
    const raw = await apiClient.get('medicines', { params })
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : []
    return {
      items: items.map(adaptBackendMedicine),
      nextCursor: raw?.nextCursor || null,
      total: raw?.total || items.length,
    }
  },

  async createMedicine(data) {
    const payload = adaptMedicineForBackend(data)
    const raw = await apiClient.post('medicines', payload)
    return adaptBackendMedicine(raw)
  },

  async updateMedicine(id, patch) {
    const payload = adaptMedicineForBackend(patch)
    const raw = await apiClient.patch(`medicines/${id}`, payload)
    return adaptBackendMedicine(raw)
  },

  async deleteMedicine(id) {
    return await apiClient.delete(`medicines/${id}`)
  },
}
