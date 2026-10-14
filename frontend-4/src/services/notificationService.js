import { useEffect, useRef } from 'react'
import { notificationsApi } from './api/index.js'
import { env } from '../config/env.js'

const POLL_INTERVAL_MS = 12000 // Poll every 12 seconds while in foreground

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Register Service Worker and request browser Notification permission using real Firebase VAPID key
 */
export async function initPushNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, status: 'unsupported' }
  }

  try {
    let permission = Notification.permission

    if (permission === 'default') {
      // Prompt user for notification permission
      permission = await Notification.requestPermission()
    }

    if (permission === 'granted' && 'serviceWorker' in navigator) {
      // Register background FCM Service Worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
      console.log('[FCM] ✅ Push Notification Service Worker registered:', registration.scope)

      let deviceToken = null

      // Subscribe to Web Push using configured VAPID key
      const vapidKey = env.firebase?.vapidKey
      if (vapidKey && 'pushManager' in registration) {
        try {
          let subscription = await registration.pushManager.getSubscription()
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })
          }

          if (subscription) {
            const endpoint = subscription.endpoint || ''
            if (endpoint.includes('/fcm/send/')) {
              deviceToken = endpoint.split('/fcm/send/')[1]
            } else if (env.firebase?.apiKey && env.firebase?.projectId) {
              // Exchange with FCM Registrations v1 API
              try {
                const p256dhKey = subscription.getKey('p256dh')
                const authKey = subscription.getKey('auth')
                if (p256dhKey && authKey) {
                  const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(p256dhKey)))
                  const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(authKey)))
                  const res = await fetch(`https://fcmregistrations.googleapis.com/v1/projects/${env.firebase.projectId}/registrations`, {
                    method: 'POST',
                    headers: {
                      'x-goog-api-key': env.firebase.apiKey,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      web: {
                        endpoint: subscription.endpoint,
                        p256dh,
                        auth,
                      },
                    }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    if (data?.token) deviceToken = data.token
                  }
                }
              } catch (regErr) {
                console.warn('[FCM] Registration exchange fallback:', regErr)
              }
            }

            if (!deviceToken && endpoint) {
              const parts = endpoint.split('/')
              deviceToken = parts[parts.length - 1]
            }
          }
        } catch (subErr) {
          console.warn('[FCM] PushManager subscription notice:', subErr)
        }
      }

      // Fallback to cached or stable device identifier if pushManager is blocked or restricted
      if (!deviceToken) {
        deviceToken = localStorage.getItem('healthsaathi_fcm_token')
        if (!deviceToken) {
          deviceToken = `fcm_${env.firebase.projectId}_${Math.random().toString(36).slice(2)}_${Date.now()}`
        }
      }

      localStorage.setItem('healthsaathi_fcm_token', deviceToken)

      // Sync registered device token with backend
      await notificationsApi.registerFcmToken(deviceToken).catch(() => {})
      return { supported: true, status: 'granted', token: deviceToken }
    }

    return { supported: true, status: permission }
  } catch (err) {
    console.warn('[FCM] Notification initialization notice:', err)
    return { supported: true, status: 'denied', error: err }
  }
}

/**
 * Foreground Web Listener for In-App Toast Alerts
 * Listens for incoming notification events (Medicine, Appointment, Lab Report)
 * and displays instant toast alerts while the user is actively on the website.
 */
export function useNotificationForegroundListener(notify, isLiveAuth) {
  const displayedIdsRef = useRef(new Set())

  useEffect(() => {
    if (!isLiveAuth) return

    // Initialize push registration on mount
    initPushNotifications().catch(() => {})

    let active = true

    async function checkNotifications() {
      if (!active || typeof document === 'undefined' || document.hidden) return

      try {
        const res = await notificationsApi.getNotifications({ unreadOnly: true, limit: 10 })
        const unreadItems = res?.items || []

        for (const item of unreadItems) {
          const id = item._id || item.id
          if (!id || displayedIdsRef.current.has(id)) continue

          displayedIdsRef.current.add(id)

          // Tone selection based on notification category
          let tone = 'info'
          if (item.type === 'LAB_REPORT_READY') tone = 'success'
          if (item.type === 'APPOINTMENT_REMINDER') tone = 'info'
          if (item.type === 'MEDICINE_SCHEDULE') tone = 'success'

          // Display Foreground In-App Toast Banner
          notify({
            title: item.title,
            description: item.body,
            tone,
          })

          // Mark read on server so it doesn't re-trigger
          await notificationsApi.markRead(id).catch(() => {})
        }
      } catch (err) {
        // Silent catch for network drops
      }
    }

    // Initial check
    checkNotifications()

    // Regular interval check
    const interval = window.setInterval(checkNotifications, POLL_INTERVAL_MS)

    // Check immediately when user switches back to active tab
    const handleVisibilityChange = () => {
      if (!document.hidden) checkNotifications()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [notify, isLiveAuth])
}
