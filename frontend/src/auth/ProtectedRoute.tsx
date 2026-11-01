import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ErrorPage } from '../pages/ErrorPage'
import { useAuth, type UserRole } from './useAuth'

/**
 * Wrap routes that need a logged-in user. Pass `roles` to restrict further:
 *   <Route element={<ProtectedRoute roles={['employer']} />}> ... </Route>
 * This is only UX — the backend enforces the same rules on every request.
 */
export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="centered">Завантаження…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // Show 403 in place (URL stays) so the user understands what happened.
  if (roles && !roles.includes(user.role)) return <ErrorPage code={403} />
  return <Outlet />
}

/** For /login and /register: logged-in users get bounced to the dashboard. */
export function GuestOnlyRoute() {
  const { user, loading } = useAuth()
  if (loading) return <p className="centered">Завантаження…</p>
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />
}
