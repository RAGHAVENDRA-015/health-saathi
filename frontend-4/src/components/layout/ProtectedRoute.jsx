import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { PageSkeleton } from '../common/PageSkeleton.jsx'

/**
 * Route wrapper that ensures the user is authenticated (or in demo mode)
 * before rendering protected application views.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <PageSkeleton />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
