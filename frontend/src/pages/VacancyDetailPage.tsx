import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { fetchCompanyProfile, type CompanyProfile } from '../api/employer'
import {
  EXPERIENCE_LABELS,
  fetchVacancyDetail,
  WORK_FORMAT_LABELS,
  type VacancyDetail,
} from '../api/vacancies'
import { useAuth } from '../auth/useAuth'
import './employer.css'

function formatDate(iso: string): string {
  try {
    const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`)
    return d.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function VacancyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [vacancy, setVacancy] = useState<VacancyDetail | null>(null)
  const [myCompany, setMyCompany] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applyModalOpen, setApplyModalOpen] = useState(false)

  useEffect(() => {
    if (user?.role === 'employer') {
      fetchCompanyProfile()
        .then((p) => setMyCompany(p))
        .catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (!id) return
    let ignore = false
    fetchVacancyDetail(id)
      .then((data) => {
        if (!ignore) setVacancy(data)
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(
            err instanceof ApiError && err.status === 404
              ? 'Вакансію не знайдено або вона була видалена.'
              : 'Не вдалося завантажити вакансію.'
          )
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="vacancy-detail-container">
        <p className="centered">Завантаження вакансії…</p>
      </div>
    )
  }

  if (error || !vacancy) {
    return (
      <div className="vacancy-detail-container">
        <Link to="/" className="back-link">
          ← Назад до каталогу
        </Link>
        <div className="empty-state">
          <h2>Вакансію не знайдено</h2>
          <p>{error || 'Ця вакансія більше не доступна.'}</p>
          <Link to="/" className="primary" style={{ display: 'inline-flex', padding: '0.75rem 1.25rem', borderRadius: 10 }}>
            Перейти до каталогу
          </Link>
        </div>
      </div>
    )
  }

  const isEmployer = user?.role === 'employer'
  const isOwner = Boolean(
    user &&
      isEmployer &&
      user.id === vacancy.employer_id &&
      (!myCompany || myCompany.company_name.trim().toLowerCase() === vacancy.company_name.trim().toLowerCase())
  )

  return (
    <div className="vacancy-detail-container">
      <Link to="/" className="back-link">
        ← Повернутися до каталогу
      </Link>

      <article className="vacancy-detail-card">
        <header className="vacancy-detail-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="vacancy-manage-company">{vacancy.company_name}</span>
            {vacancy.status === 'active' ? (
              <span className="badge badge-active">● Активна</span>
            ) : (
              <span className="badge badge-closed">○ Закрита</span>
            )}
          </div>

          <h1>{vacancy.title}</h1>

          <ul className="vacancy-detail-tags">
            <li>📍 {vacancy.location}</li>
            <li>🏢 {WORK_FORMAT_LABELS[vacancy.work_format]}</li>
            <li>🎓 {EXPERIENCE_LABELS[vacancy.experience]}</li>
            <li>🏷️ {vacancy.industry}</li>
            <li>📅 Опубліковано: {formatDate(vacancy.created_at)}</li>
          </ul>
        </header>

        <section className="vacancy-detail-content">
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Опис позиції</h3>
          <p style={{ whiteSpace: 'pre-line' }}>{vacancy.description}</p>
        </section>

        <footer className="vacancy-detail-footer">
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
              Компанія: <strong>{vacancy.company_name}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {isOwner ? (
              <>
                <span className="badge badge-active" style={{ fontSize: '0.85rem' }}>
                  🏢 Ваша вакансія
                </span>
                <Link to={`/employer/vacancies/${vacancy.id}/edit`} className="btn-sm btn-primary">
                  ✏️ Редагувати вакансію
                </Link>
              </>
            ) : isEmployer ? (
              <span
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--muted)',
                  padding: '0.45rem 0.9rem',
                  background: 'var(--surface-2)',
                  borderRadius: 8,
                }}
              >
                ℹ️ Роботодавці не можуть відгукуватися на вакансії
              </span>
            ) : vacancy.status === 'active' ? (
              <button
                type="button"
                className="primary"
                style={{ margin: 0, paddingInline: '1.5rem' }}
                onClick={() => setApplyModalOpen(true)}
              >
                Відгукнутися на вакансію
              </button>
            ) : (
              <span className="badge badge-closed" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
                Прийом відгуків закрито
              </span>
            )}
          </div>
        </footer>
      </article>

      {/* Modal for application info (candidates and guests only) */}
      {applyModalOpen && !isEmployer && (
        <div className="modal-backdrop" onClick={() => setApplyModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Відгук на вакансію</h3>
            <p>
              Ви збираєтеся відгукнутися на позицію <strong>«{vacancy.title}»</strong> у компанії{' '}
              <strong>{vacancy.company_name}</strong>.
            </p>
            {user ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                Ваш профіль кандидата ({user.full_name}, {user.email}) буде надіслано роботодавцю.
              </p>
            ) : (
              <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                Для надсилання резюме та спілкування з роботодавцем, будь ласка,{' '}
                <Link to="/login">увійдіть</Link> або <Link to="/register">зареєструйтесь</Link>.
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-sm" onClick={() => setApplyModalOpen(false)}>
                Скасувати
              </button>
              {user && (
                <button
                  type="button"
                  className="btn-sm btn-primary"
                  onClick={() => {
                    alert('Дякуємо! Функціонал прямого відгуку та чату входить у модуль "Відгуки та Внутрішній Чат".')
                    setApplyModalOpen(false)
                  }}
                >
                  Підтвердити відгук
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
