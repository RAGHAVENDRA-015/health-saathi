/**
 * Runtime environment configuration for HealthSaathi AI Frontend.
 * Reads Vite environment variables with defensive fallbacks.
 */

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  apiProxyTarget: import.meta.env.VITE_API_PROXY_TARGET || 'http://localhost:3001',
  enableMockFallback: import.meta.env.VITE_ENABLE_MOCK_FALLBACK !== 'false',
  groqApiKey: import.meta.env.VITE_GROQ_API_KEY,
  groqModel: import.meta.env.VITE_GROQ_MODEL,
  
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ai-copilot-54fa9',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_FIREBASE_GOOGLE_CLIENT_ID || '',
  },

  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}
