import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EmployerDashboardPage } from './EmployerDashboardPage'
import { CandidateDashboardPage } from './CandidateDashboardPage'

const roleLabel = { candidate: 'Кандидат', employer: 'Роботодавець', admin: 'Адміністратор' }

export function DashboardPage() {
  const { user, logout, logoutAll } = useAuth()
  if (!user) return null
  if (user.role === 'candidate') return <CandidateDashboardPage />

  if (user.role === 'employer') {
    return <EmployerDashboardPage />
  }

  return (
    <div className="employer-container" style={{ maxWidth: 640 }}>
      <header className="employer-top-nav">
        <Link to="/" className="nav-brand">
          HireDove
        </Link>
        <Link to="/" className="btn-sm">
          Каталог вакансій
        </Link>
      </header>

      <main className="auth-card" style={{ margin: '2rem auto' }}>
        <h1>Вітаємо, {user.full_name}!</h1>
        <p>
          {user.email} · <span className="user-badge">{roleLabel[user.role]}</span>
        </p>

        <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'var(--surface-2)', borderRadius: 10 }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Особистий простір</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
            Ви увійшли як {roleLabel[user.role]}. Ви можете переглядати каталог вакансій, шукати цікаві позиції та відгукуватися на них.
          </p>
        </div>

        <div className="actions" style={{ marginTop: '1.5rem' }}>
          <Link to="/" className="primary" style={{ display: 'inline-flex', padding: '0.75rem 1.25rem', borderRadius: 10 }}>
            Перейти до пошуку вакансій
          </Link>
          <button type="button" onClick={logout}>
            Вийти
          </button>
          <button type="button" className="secondary" onClick={logoutAll}>
            Вийти з усіх пристроїв
          </button>
        </div>
      </main>
    </div>
  )
}
