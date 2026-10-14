import { apiClient } from './apiClient.js'
import { adaptBackendDocument, adaptBackendAppointment } from '../../utils/adapters.js'

export const dashboardApi = {
  async getDashboardSummary() {
    const raw = await apiClient.get('dashboard')
    if (!raw) return null

    return {
      documents: raw.documents || { total: 0, byType: {} },
      recentDocuments: Array.isArray(raw.recentDocuments)
        ? raw.recentDocuments.map(adaptBackendDocument)
        : [],
      upcomingAppointments: Array.isArray(raw.upcomingAppointments)
        ? raw.upcomingAppointments.map(adaptBackendAppointment)
        : [],
      activeMedicines: raw.activeMedicines || 0,
      pendingReminders: raw.pendingReminders || 0,
      abnormalFindings: raw.abnormalFindings || [],
    }
  },
}
