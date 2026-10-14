import { Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout.jsx'
import { ProtectedRoute } from '../components/layout/ProtectedRoute.jsx'
import { PageSkeleton } from '../components/common/PageSkeleton.jsx'
import { RootErrorBoundary } from '../components/common/RootErrorBoundary.jsx'
import { lazyWithRetry } from '../utils/lazyWithRetry.js'

// Resilient dynamic imports with automatic retry for module/chunk updates
const LandingPage = lazyWithRetry(() => import('../pages/LandingPage.jsx'))
const AuthPage = lazyWithRetry(() => import('../pages/AuthPage.jsx'))
const DashboardPage = lazyWithRetry(() => import('../pages/DashboardPage.jsx'))
const UploadPage = lazyWithRetry(() => import('../pages/UploadPage.jsx'))
const RecordsPage = lazyWithRetry(() => import('../pages/RecordsPage.jsx'))
const DocumentAnalysisPage = lazyWithRetry(() => import('../pages/DocumentAnalysisPage.jsx'))
const CopilotPage = lazyWithRetry(() => import('../pages/CopilotPage.jsx'))
const TimelinePage = lazyWithRetry(() => import('../pages/TimelinePage.jsx'))
const MedicinesPage = lazyWithRetry(() => import('../pages/MedicinesPage.jsx'))
const AppointmentsPage = lazyWithRetry(() => import('../pages/AppointmentsPage.jsx'))
const RemindersPage = lazyWithRetry(() => import('../pages/RemindersPage.jsx'))
const ProfilePage = lazyWithRetry(() => import('../pages/ProfilePage.jsx'))
const ReportsPage = lazyWithRetry(() => import('../pages/ReportsPage.jsx'))
import NotFoundPage from '../pages/NotFoundPage.jsx'

function suspense(element) {
  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RootErrorBoundary />,
    children: [
      { index: true, element: suspense(<LandingPage />) },
      { path: 'login', element: suspense(<AuthPage mode="login" />) },
      { path: 'register', element: suspense(<AuthPage mode="register" />) },
      { path: 'forgot-password', element: suspense(<AuthPage mode="forgot" />) },
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        errorElement: <RootErrorBoundary />,
        children: [
          { path: 'dashboard', element: suspense(<DashboardPage />) },
          { path: 'upload', element: suspense(<UploadPage />) },
          { path: 'records', element: suspense(<RecordsPage />) },
          { path: 'records/:documentId', element: suspense(<DocumentAnalysisPage />) },
          { path: 'reports', element: suspense(<ReportsPage />) },
          { path: 'copilot', element: suspense(<CopilotPage />) },
          { path: 'timeline', element: suspense(<TimelinePage />) },
          { path: 'medicines', element: suspense(<MedicinesPage />) },
          { path: 'appointments', element: suspense(<AppointmentsPage />) },
          { path: 'reminders', element: suspense(<RemindersPage />) },
          { path: 'profile', element: suspense(<ProfilePage />) },
        ],
      },
      { path: '*', element: suspense(<NotFoundPage />) },
    ],
  },
])
