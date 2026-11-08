import { useEffect, useState } from 'react'
import { SaveVacancyButton } from '../components/candidate/SaveVacancyButton'
import { Link, useParams } from 'react-router-dom'
import {
  APPLICATION_STATUS_LABELS,
  fetchMyApplications,
  submitApplication,
  type ApplicationItem,
} from '../api/applications'
import { ApiError } from '../api/client'
import { fetchCompanyProfile, type CompanyProfile } from '../api/employer'
import {
  EXPERIENCE_LABELS,
  fetchVacancyDetail,
  WORK_FORMAT_LABELS,
  type VacancyDetail,
} from '../api/vacancies'
import { useAuth } from '../auth/useAuth'
import { openChatWithApplication } from '../components/ChatWidget'
import { HeaderTools } from '../components/HeaderTools'
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
  const [myApplication, setMyApplication] = useState<ApplicationItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'employer') {
      fetchCompanyProfile()
        .then((p) => setMyCompany(p))
        .catch(() => {})
    } else if (user?.role === 'candidate' && id) {
      fetchMyApplications()
        .then((apps) => {
          const found = apps.find((a) => a.vacancy_id === Number(id))
          if (found) setMyApplication(found)
        })
        .catch(() => {})
    }
  }, [user, id])

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

  const handleApplySubmit = async () => {
    if (!vacancy || submitting) return
    setSubmitting(true)
    setApplyError(null)
    try {
      const created = await submitApplication(vacancy.id, coverLetter)
      setMyApplication(created)
      setApplyModalOpen(false)
      setCoverLetter('')
    } catch (err: unknown) {
      setApplyError(err instanceof ApiError ? err.message : 'Не вдалося надіслати відгук.')
    } finally {
      setSubmitting(false)
    }
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Link to="/" className="back-link" style={{ marginBottom: 0 }}>
          ← Повернутися до каталогу
        </Link>
        <HeaderTools />
      </div>

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
            ) : myApplication ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span className="badge badge-active" style={{ padding: '0.55rem 0.9rem', fontSize: '0.88rem' }}>
                  ✓ Ви вже відгукнулися ({APPLICATION_STATUS_LABELS[myApplication.status]})
                </span>
                <button
                  type="button"
                  className="btn-sm btn-primary"
                  onClick={() => openChatWithApplication(myApplication.id)}
                >
                  💬 Написати роботодавцю
                </button>
              </div>
            ) : vacancy.status === 'active' ? (
              <button
                type="button"
                className="primary"
                style={{ margin: 0, paddingInline: '1.5rem' }}
                onClick={() => {
                  setApplyError(null)
                  setApplyModalOpen(true)
                }}
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

      {vacancy.status === 'active' && <SaveVacancyButton key={vacancy.id} vacancyId={vacancy.id} />}

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
              <>
                <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Ваш профіль кандидата ({user.full_name}, {user.email}) та збережене резюме будуть надіслані роботодавцю.
                </p>
                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Супровідний лист (необов’язково)
                  </label>
                  <textarea
                    rows={4}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Напишіть коротко, чому вас зацікавила ця позиція..."
                    style={{ width: '100%' }}
                  />
                </div>
                {applyError && (
                  <div className="alert-box alert-error" style={{ marginTop: '0.75rem' }}>
                    {applyError}
                  </div>
                )}
              </>
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
                  disabled={submitting}
                  onClick={handleApplySubmit}
                >
                  {submitting ? 'Надсилання…' : 'Підтвердити відгук'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}