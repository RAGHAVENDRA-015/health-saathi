import { apiClient } from './apiClient.js'
import { adaptBackendDocument } from '../../utils/adapters.js'

const FRONTEND_TYPE_TO_BACKEND = {
  lab: 'LAB_REPORT',
  prescription: 'PRESCRIPTION',
  discharge: 'DISCHARGE_SUMMARY',
  scan: 'SCAN',
  vaccine: 'VACCINATION',
  other: 'OTHER',
}

export const documentsApi = {
  /**
   * Fetch documents list with optional query params
   */
  async getDocuments(params = {}) {
    const raw = await apiClient.get('documents', { params })
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : []
    return {
      items: items.map(adaptBackendDocument),
      nextCursor: raw?.nextCursor || null,
      total: raw?.total || items.length,
    }
  },

  /**
   * Fetch single document by ID
   */
  async getDocumentById(id) {
    const raw = await apiClient.get(`documents/${id}`)
    return adaptBackendDocument(raw)
  },

  /**
   * Upload document file with metadata
   */
  async uploadDocument({ file, title, type, date, description }) {
    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('name', title)
    if (type) formData.append('documentType', FRONTEND_TYPE_TO_BACKEND[type] || 'OTHER')
    if (date) formData.append('documentDate', new Date(date).toISOString())
    if (description) formData.append('description', description)

    const raw = await apiClient.upload('documents/uploads', formData)
    return adaptBackendDocument(raw)
  },

  /**
   * Download original document or signed URL
   */
  async getDownloadUrl(id) {
    return await apiClient.get(`documents/${id}/download`)
  },

  /**
   * Get extracted lab findings for document
   */
  async getFindings(id) {
    return await apiClient.get(`documents/${id}/findings`)
  },

  /**
   * Delete document by ID
   */
  async deleteDocument(id) {
    return await apiClient.delete(`documents/${id}`)
  },
}
