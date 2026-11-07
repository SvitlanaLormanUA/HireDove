import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  deleteVacancy,
  updateVacancyStatus,
  type EmployerVacanciesResponse,
} from '../../api/employer'
import {
  EXPERIENCE_LABELS,
  WORK_FORMAT_LABELS,
  type VacancyDetail,
  type VacancyStatus,
} from '../../api/vacancies'

interface Props {
  data: EmployerVacanciesResponse
  activeStatusFilter: VacancyStatus | null
  onFilterChange: (status: VacancyStatus | null) => void
  onRefresh: () => void
}

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

export function EmployerVacanciesSection({
  data,
  activeStatusFilter,
  onFilterChange,
  onRefresh,
}: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleToggleStatus = async (v: VacancyDetail) => {
    const nextStatus: VacancyStatus = v.status === 'active' ? 'closed' : 'active'
    setActionLoadingId(v.id)
    setActionError(null)
    try {
      await updateVacancyStatus(v.id, nextStatus)
      onRefresh()
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError ? err.message : 'Не вдалося змінити статус вакансії'
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setActionLoadingId(deletingId)
    setActionError(null)
    try {
      await deleteVacancy(deletingId)
      setDeletingId(null)
      onRefresh()
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError ? err.message : 'Не вдалося видалити вакансію'
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div>
      {actionError && <div className="alert-box alert-error">{actionError}</div>}

      <div className="vacancies-toolbar">
        <div className="status-filter-pills">
          <button
            type="button"
            className={`pill-btn ${activeStatusFilter === null ? 'active' : ''}`}
            onClick={() => onFilterChange(null)}
          >
            Всі ({data.total})
          </button>
          <button
            type="button"
            className={`pill-btn ${activeStatusFilter === 'active' ? 'active' : ''}`}
            onClick={() => onFilterChange('active')}
          >
            Активні ({data.active_count})
          </button>
          <button
            type="button"
            className={`pill-btn ${activeStatusFilter === 'closed' ? 'active' : ''}`}
            onClick={() => onFilterChange('closed')}
          >
            Закриті ({data.closed_count})
          </button>
        </div>

        <Link to="/employer/vacancies/new" className="button-link primary" style={{ margin: 0 }}>
          + Створити нову вакансію
        </Link>
      </div>

      {data.items.length === 0 ? (
        <div className="empty-state">
          <h2>
            {activeStatusFilter
              ? `Немає ${activeStatusFilter === 'active' ? 'активних' : 'закритих'} вакансій`
              : 'Ви ще не опублікували жодної вакансії'}
          </h2>
          <p>
            Створіть перше оголошення про роботу або стажування, щоб знайти талановитих студентів та джуніорів!
          </p>
          <Link to="/employer/vacancies/new" className="primary" style={{ display: 'inline-flex', padding: '0.75rem 1.25rem', borderRadius: 10 }}>
            Опублікувати першу вакансію
          </Link>
        </div>
      ) : (
        <div className="vacancies-manage-list">
          {data.items.map((v) => {
            const isLoading = actionLoadingId === v.id
            return (
              <article key={v.id} className="vacancy-manage-card">
                <div className="vacancy-manage-header">
                  <div>
                    <h3 className="vacancy-manage-title">
                      <Link to={`/vacancies/${v.id}`}>{v.title}</Link>
                    </h3>
                    <p className="vacancy-manage-company">{v.company_name}</p>
                  </div>
                  <div>
                    {v.status === 'active' ? (
                      <span className="badge badge-active">● Активна</span>
                    ) : (
                      <span className="badge badge-closed">○ Закрита</span>
                    )}
                  </div>
                </div>

                <ul className="vacancy-manage-meta">
                  <li>📍 {v.location}</li>
                  <li>🏢 {WORK_FORMAT_LABELS[v.work_format]}</li>
                  <li>🎓 {EXPERIENCE_LABELS[v.experience]}</li>
                  <li>🏷️ {v.industry}</li>
                </ul>

                <p className="vacancy-snippet" style={{ color: 'var(--muted)', fontSize: '0.925rem' }}>
                  {v.description.length > 200
                    ? `${v.description.slice(0, 200)}…`
                    : v.description}
                </p>

                <div className="vacancy-manage-actions">
                  <span className="vacancy-date">
                    Опубліковано: {formatDate(v.created_at)}
                  </span>

                  <div className="btn-group">
                    <button
                      type="button"
                      className="btn-sm"
                      disabled={isLoading}
                      onClick={() => handleToggleStatus(v)}
                    >
                      {v.status === 'active' ? '🔒 Закрити прийом' : '🔓 Активувати'}
                    </button>
                    <Link
                      to={`/employer/vacancies/${v.id}/edit`}
                      className="btn-sm"
                    >
                      ✏️ Редагувати
                    </Link>
                    <Link
                      to={`/vacancies/${v.id}`}
                      className="btn-sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      👁️ Переглянути
                    </Link>
                    <button
                      type="button"
                      className="btn-sm btn-danger"
                      disabled={isLoading}
                      onClick={() => setDeletingId(v.id)}
                    >
                      🗑️ Видалити
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId !== null && (
        <div className="modal-backdrop" onClick={() => setDeletingId(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Підтвердження видалення</h3>
            <p>
              Ви впевнені, що хочете остаточно видалити цю вакансію? Цю дію неможливо скасувати.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={() => setDeletingId(null)}
              >
                Скасувати
              </button>
              <button
                type="button"
                className="btn-sm btn-danger"
                disabled={actionLoadingId !== null}
                onClick={handleDelete}
              >
                {actionLoadingId !== null ? 'Видалення…' : 'Так, видалити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
