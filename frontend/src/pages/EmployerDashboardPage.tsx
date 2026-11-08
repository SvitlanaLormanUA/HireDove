import { HeaderTools } from '../components/HeaderTools'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  fetchCompanyProfile,
  fetchEmployerVacancies,
  type CompanyProfile,
  type EmployerVacanciesResponse,
} from '../api/employer'
import type { VacancyStatus } from '../api/vacancies'
import { useAuth } from '../auth/useAuth'
import { CompanyProfileSection } from '../components/employer/CompanyProfileSection'
import { EmployerVacanciesSection } from '../components/employer/EmployerVacanciesSection'
import './employer.css'

export function EmployerDashboardPage() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'vacancies' | 'profile'>('vacancies')
  const [statusFilter, setStatusFilter] = useState<VacancyStatus | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [data, setData] = useState<EmployerVacanciesResponse | null>(null)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleRefresh = useCallback(() => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    fetchCompanyProfile()
      .then((p) => setCompanyProfile(p))
      .catch(() => {})
  }, [reloadKey])

  useEffect(() => {
    let ignore = false
    fetchEmployerVacancies(statusFilter ?? undefined)
      .then((res) => {
        if (!ignore) setData(res)
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(
            err instanceof ApiError ? err.message : 'Не вдалося завантажити вакансії'
          )
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [statusFilter, reloadKey])

  return (
    <div className="employer-container">
      {/* Top Bar */}
      <header className="employer-top-nav">
        <Link to="/" className="nav-brand">
          HireDove
        </Link>

        <div className="employer-user-meta">
          <HeaderTools />
          <span className="user-badge">Роботодавець</span>
          <span>{companyProfile?.company_name || user?.full_name}</span>
          <button
            type="button"
            className="btn-sm"
            onClick={logout}
            style={{ marginLeft: '0.5rem' }}
          >
            Вийти
          </button>
        </div>
      </header>

      {/* Hero with greeting & stats */}
      <section className="employer-hero">
        <h1>
          Кабінет компанії {companyProfile ? `«${companyProfile.company_name}»` : 'роботодавця'}
        </h1>
        <p>
          Тут відображаються виключно вакансії вашої компанії. Керуйте їхнім статусом, публікуйте нові або оновлюйте дані бренду.
        </p>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{data?.total ?? 0}</span>
            <span className="stat-label">Всього оголошень</span>
          </div>
          <div className="stat-card">
            <span className="stat-value" style={{ color: 'var(--success)' }}>
              {data?.active_count ?? 0}
            </span>
            <span className="stat-label">Активні вакансії</span>
          </div>
          <div className="stat-card">
            <span className="stat-value" style={{ color: 'var(--muted)' }}>
              {data?.closed_count ?? 0}
            </span>
            <span className="stat-label">Закриті вакансії</span>
          </div>
        </div>
      </section>

      {/* Tabs navigation */}
      <div className="tabs-nav">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'vacancies' ? 'active' : ''}`}
          onClick={() => setActiveTab('vacancies')}
        >
          📋 Мої вакансії
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          🏢 Профіль компанії
        </button>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}

      {/* Tab contents */}
      {activeTab === 'vacancies' && (
        <>
          {loading && !data ? (
            <p className="centered">Завантаження вакансій…</p>
          ) : data ? (
            <EmployerVacanciesSection
              data={data}
              activeStatusFilter={statusFilter}
              onFilterChange={setStatusFilter}
              onRefresh={handleRefresh}
            />
          ) : null}
        </>
      )}

      {activeTab === 'profile' && <CompanyProfileSection onSaved={handleRefresh} />}
    </div>
  )
}
