import { useTranslation } from 'react-i18next'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { SUPPORTED_LANGUAGES, setAppLanguage } from '../../i18n/index.js'
import { Dropdown, DropdownItem } from './Dropdown.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { userApi } from '../../services/api/userApi.js'
import { useToast } from '../../context/ToastContext.jsx'

export function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation()
  const { isLiveAuth, updateProfile, user } = useAuth()
  const { notify } = useToast()

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === (i18n.language || 'en')) || SUPPORTED_LANGUAGES[0]

  const handleChangeLanguage = async (code, closeDropdown) => {
    closeDropdown()
    if (code === i18n.language) return

    setAppLanguage(code)

    if (isLiveAuth) {
      try {
        await userApi.updatePreferences({
          language: code,
          preferredLanguage: code,
          hasSelectedLanguage: true,
        })
      } catch (err) {
        console.warn('[LanguageSwitcher] Backend preference update warning:', err)
      }
    }

    if (updateProfile) {
      try {
        await updateProfile({
          preferences: {
            ...(user?.preferences || {}),
            language: code,
            preferredLanguage: code,
            hasSelectedLanguage: true,
          },
        })
      } catch {
        // ignore
      }
    }

    const selectedItem = SUPPORTED_LANGUAGES.find((l) => l.code === code)
    notify({
      title: `${selectedItem?.nativeName || 'Language'} selected`,
      description: `Interface language updated to ${selectedItem?.label || code}.`,
      tone: 'neutral',
    })
  }

  return (
    <div className={`relative ${className}`}>
      <Dropdown
        panelClassName="w-48"
        renderTrigger={({ triggerProps, open }) => (
          <button
            type="button"
            {...triggerProps}
            aria-label={t('topbar.switch_language')}
            title={t('topbar.switch_language')}
            className={`flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 text-xs font-bold transition hover:bg-white/80 ${
              open ? 'bg-white shadow-xs text-navy-900' : 'text-navy-800'
            }`}
          >
            <Globe className="size-4 text-brand-600" aria-hidden="true" />
            <span className="hidden sm:inline font-semibold">{currentLang.nativeName}</span>
            <ChevronDown
              className={`size-3 text-navy-600 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      >
        {({ close }) => (
          <div className="py-1">
            <div className="px-3 py-1.5 border-b border-ice-100 text-[11px] font-bold uppercase tracking-wider text-muted">
              {t('topbar.language')}
            </div>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = (i18n.language || 'en') === lang.code
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleChangeLanguage(lang.code, close)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl text-left transition ${
                    isSelected ? 'bg-brand-50 text-brand-700 font-bold' : 'text-navy-900 hover:bg-ice-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-navy-600 uppercase">
                      {lang.code}
                    </span>
                    <span>{lang.nativeName}</span>
                  </div>
                  {isSelected && <Check className="size-3.5 text-brand-600 stroke-[3]" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        )}
      </Dropdown>
    </div>
  )
}
