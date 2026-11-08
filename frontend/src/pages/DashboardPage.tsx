import { useAuth } from '../auth/useAuth'
import { EmployerDashboardPage } from './EmployerDashboardPage'
import { CandidateDashboardPage } from './CandidateDashboardPage'
import { AdminDashboardPage } from './AdminDashboardPage'

export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null
  if (user.role === 'candidate') return <CandidateDashboardPage />
  if (user.role === 'employer') return <EmployerDashboardPage />
  return <AdminDashboardPage />
}
