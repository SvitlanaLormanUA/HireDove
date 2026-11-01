import { useAuth } from '../auth/useAuth'

const roleLabel = { candidate: 'Кандидат', employer: 'Роботодавець', admin: 'Адміністратор' }

// Placeholder until the candidate/employer cabinets are built.
export function DashboardPage() {
  const { user, logout, logoutAll } = useAuth()
  if (!user) return null

  return (
    <main className="auth-card">
      <h1>Вітаємо, {user.full_name}!</h1>
      <p>
        {user.email} · {roleLabel[user.role]}
      </p>
      <div className="actions">
        <button onClick={logout}>Вийти</button>
        <button className="secondary" onClick={logoutAll}>Вийти з усіх пристроїв</button>
      </div>
    </main>
  )
}
