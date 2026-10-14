import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Globe, Languages, Loader2, AlertCircle } from 'lucide-react'
import { SUPPORTED_LANGUAGES, setAppLanguage } from '../../i18n/index.js'
import { userApi } from '../../services/api/userApi.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { storageService } from '../../services/storageService.js'

export function LanguageSelectionModal({ open, onComplete }) {
  const { t, i18n } = useTranslation()
  const { user, isLiveAuth, updateProfile } = useAuth()
  const [selectedLang, setSelectedLang] = useState(i18n.language || 'en')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  if (!open) return null

  const handleSelect = (langCode) => {
    setSelectedLang(langCode)
    setAppLanguage(langCode)
    setErrorMessage(null)
  }

  const handleContinue = async () => {
    setIsSaving(true)
    setErrorMessage(null)

    try {
      // 1. Immediately apply the chosen language locally
      setAppLanguage(selectedLang)

      const uid = user?.uid || user?.id || user?.email
      if (uid) {
        storageService.set(`healthsaathi_has_selected_language_${uid}`, true)
      }

      // 2. Persist to MongoDB backend profile if live-authenticated
      if (isLiveAuth) {
        try {
          await userApi.updatePreferences({
            language: selectedLang,
            preferredLanguage: selectedLang,
            hasSelectedLanguage: true,
          })
        } catch (apiErr) {
          console.warn('[LanguageSelectionModal] Live backend preference update fallback:', apiErr)
          // Fall back to updateProfile
          if (updateProfile) {
            await updateProfile({
              preferences: {
                ...(user?.preferences || {}),
                language: selectedLang,
                preferredLanguage: selectedLang,
                hasSelectedLanguage: true,
              },
            })
          }
        }
      } else if (updateProfile) {
        await updateProfile({
          preferences: {
            ...(user?.preferences || {}),
            language: selectedLang,
            preferredLanguage: selectedLang,
            hasSelectedLanguage: true,
          },
        })
      }

      setIsSaving(false)
      if (onComplete) onComplete(selectedLang)
    } catch (err) {
      console.error('[LanguageSelectionModal] Failed to persist language:', err)
      setIsSaving(false)
      setErrorMessage(t('language_modal.save_error'))
    }
  }

  const getContinueButtonLabel = () => {
    if (selectedLang === 'te') return t('language_modal.continue_btn_te')
    if (selectedLang === 'hi') return t('language_modal.continue_btn_hi')
    return t('language_modal.continue_btn')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-pop border border-ice-100 flex flex-col gap-6">
        {/* Header with globe icon */}
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
            <Globe className="size-6 text-brand-600 animate-pulse" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="language-modal-title"
              className="text-xl sm:text-2xl font-extrabold tracking-tight text-navy-900"
            >
              {t('language_modal.title')}
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-medium text-brand-700">
              {t('language_modal.subtitle')}
            </p>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-sm text-navy-800/80 leading-relaxed">
          {t('language_modal.description')}
        </p>

        {/* Language Selection Radio Cards */}
        <div className="space-y-3" role="radiogroup" aria-label={t('language_modal.select_prompt')}>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selectedLang === lang.code
            return (
              <button
                key={lang.code}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50/70 shadow-xs ring-2 ring-brand-400/20'
                    : 'border-ice-200 bg-white hover:border-brand-200 hover:bg-ice-50/50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-ice-100 text-navy-900 font-bold text-sm">
                    {lang.code.toUpperCase()}
                  </span>
                  <div>
                    <span className="block text-base font-bold text-navy-900">
                      {lang.nativeName}
                    </span>
                    <span className="block text-xs text-muted">
                      {lang.sub}
                    </span>
                  </div>
                </div>

                <div
                  className={`grid size-6 place-items-center rounded-full border ${
                    isSelected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-ice-300 bg-white'
                  }`}
                >
                  {isSelected && <Check className="size-3.5 stroke-[3]" aria-hidden="true" />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Error message if saving failed */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-red-50 p-3.5 text-xs text-red-800 border border-red-200">
            <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleContinue}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-navy-900 py-3.5 px-6 text-sm sm:text-base font-bold text-white shadow-card hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 transition"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span>{t('language_modal.saving')}</span>
              </>
            ) : (
              <>
                <Languages className="size-4" aria-hidden="true" />
                <span>{getContinueButtonLabel()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
