import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslation from './locales/en/translation.json'
import teTranslation from './locales/te/translation.json'
import hiTranslation from './locales/hi/translation.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English', sub: 'English (Default)' },
  { code: 'te', label: 'Telugu', nativeName: 'తెలుగు', sub: 'Telugu · తెలుగు' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी', sub: 'Hindi · हिन्दी' },
]

export const LANGUAGE_CODES = ['en', 'te', 'hi']

const resources = {
  en: { translation: enTranslation },
  te: { translation: teTranslation },
  hi: { translation: hiTranslation },
}

// Check initial cached language without throwing
function getInitialLanguage() {
  try {
    const cached = localStorage.getItem('healthsaathi_preferred_language')
    if (cached && LANGUAGE_CODES.includes(cached)) {
      return cached
    }
  } catch {
    // localStorage not accessible
  }
  return 'en'
}

const initialLanguage = getInitialLanguage()

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    supportedLngs: LANGUAGE_CODES,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  })

// Set document html lang attribute
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage
}

export function setAppLanguage(lang) {
  if (!LANGUAGE_CODES.includes(lang)) return
  i18n.changeLanguage(lang)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang
  }
  try {
    localStorage.setItem('healthsaathi_preferred_language', lang)
  } catch {
    // ignore
  }
}

export default i18n
