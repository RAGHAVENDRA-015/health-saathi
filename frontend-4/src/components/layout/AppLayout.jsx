import { Suspense, useState, useEffect } from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Modal } from '../common/Modal.jsx'
import { PageSkeleton } from '../common/PageSkeleton.jsx'
import { LanguageSelectionModal } from '../common/LanguageSelectionModal.jsx'
import { SidebarContent } from './Sidebar.jsx'
import { TopBar } from './TopBar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { storageService } from '../../services/storageService.js'

export function AppLayout() {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const closeNav = () => setIsNavOpen(false)

  const { user, isLiveAuth } = useAuth()
  const uid = user?.uid || user?.id || user?.email

  const [showLanguageModal, setShowLanguageModal] = useState(false)

  useEffect(() => {
    if (isLiveAuth && uid) {
      const hasLocallySaved = storageService.get(`healthsaathi_has_selected_language_${uid}`, false)
      const hasServerPreference = Boolean(user?.preferences?.hasSelectedLanguage)
      if (!hasLocallySaved && !hasServerPreference) {
        setShowLanguageModal(true)
      } else {
        setShowLanguageModal(false)
      }
    } else {
      setShowLanguageModal(false)
    }
  }, [isLiveAuth, uid, user?.preferences?.hasSelectedLanguage])

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <div className="mx-auto flex max-w-[1680px] gap-3.5 sm:gap-5 p-2 sm:p-4 lg:gap-6 lg:p-5">
        <aside className="panel sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-64 shrink-0 lg:block">
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <TopBar onOpenNav={() => setIsNavOpen(true)} />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>

      <Modal open={isNavOpen} onClose={closeNav} title="Navigation" variant="drawer" hideHeader>
        <SidebarContent onNavigate={closeNav} />
      </Modal>

      <LanguageSelectionModal
        open={showLanguageModal}
        onComplete={() => setShowLanguageModal(false)}
      />

      <ScrollRestoration />
    </div>
  )
}
