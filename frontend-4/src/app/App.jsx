import { RouterProvider } from 'react-router-dom'
import { router } from './router.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { HealthDataProvider } from '../context/HealthDataContext.jsx'
import { ToastProvider } from '../context/ToastContext.jsx'
import { ErrorBoundary } from '../components/common/RootErrorBoundary.jsx'

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <HealthDataProvider>
            <RouterProvider router={router} />
          </HealthDataProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
