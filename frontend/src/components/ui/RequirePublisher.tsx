import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/stores/auth'

/** Restrict catalog management to server-confirmed CIEM administrators. */
export function RequirePublisher() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const canPublish = useAuthStore((s) => s.user?.is_ciem_manager === true)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!canPublish) {
    return (
      <Navigate
        to="/"
        state={{ notice: 'publisher_required', from: location.pathname }}
        replace
      />
    )
  }

  return <Outlet />
}
