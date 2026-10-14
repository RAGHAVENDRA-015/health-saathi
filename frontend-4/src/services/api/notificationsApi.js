import { apiClient } from './apiClient.js'

export const notificationsApi = {
  /**
   * Register user FCM push token
   */
  registerFcmToken: (token) => apiClient.post('/notifications/fcm-token', { token }),

  /**
   * Get user notifications
   */
  getNotifications: (params = {}) => apiClient.get('/notifications', { params }),

  /**
   * Mark notification as read
   */
  markRead: (id) => apiClient.post(`/notifications/${id}/read`),

  /**
   * Mark all notifications as read
   */
  markAllRead: () => apiClient.post('/notifications/read-all'),

  /**
   * Trigger test notification for verification
   */
  triggerTest: (payload) => apiClient.post('/notifications/trigger-test', payload),
}
