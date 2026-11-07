import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  createVacancy,
  fetchCompanyProfile,
  fetchEmployerVacancy,
  updateVacancy,
  type VacancyInput,
} from '../api/employer'
import {
  EXPERIENCE_LABELS,
  WORK_FORMAT_LABELS,
  type ExperienceLevel,
  type VacancyStatus,
  type WorkFormat,
} from '../api/vacancies'
import { useAuth } from '../auth/useAuth'
import './employer.css'

export function VacancyFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileCompanyName, setProfileCompanyName] = useState<string | null>(null)

  // Fields
  const [title, setTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [location, setLocation] = useState('')
  const [industry, setIndustry] = useState('')
  const [workFormat, setWorkFormat] = useState<WorkFormat>('remote')
  const [experience, setExperience] = useState<ExperienceLevel>('none')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<VacancyStatus>('active')

  // Load existing vacancy or company profile default
  useEffect(() => {
    let ignore = false

    // Prefill / lock company name if profile exists
    fetchCompanyProfile()
      .then((p) => {
        if (!ignore && p) {
          if (p.company_name) {
            setProfileCompanyName(p.company_name)
            if (!isEdit) setCompanyName(p.company_name)
          }
          if (!isEdit && p.location) setLocation(p.location)
          if (!isEdit && p.industry) setIndustry(p.industry)
        }
      })
      .catch(() => {
        // ignore profile load errors
      })

    if (isEdit && id) {
      fetchEmployerVacancy(id)
        .then((v) => {
          if (!ignore) {
            if (user && v.employer_id !== user.id) {
              setError('Доступ заборонено: ви можете редагувати лише вакансії своєї компанії.')
              return
            }
            setTitle(v.title)
            setCompanyName(v.company_name)
            setLocation(v.location)
            setIndustry(v.industry)
            setWorkFormat(v.work_format)
            setExperience(v.experience)
            setDescription(v.description)
            setStatus(v.status)
          }
        })
        .catch((err: unknown) => {
          if (!ignore) {
            if (err instanceof ApiError && err.status === 403) {
              setError('Доступ заборонено: ви не можете редагувати вакансії чужих компаній.')
            } else {
              setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити вакансію')
            }
          }
        })
        .finally(() => {
          if (!ignore) setLoading(false)
        })
    }

    return () => {
      ignore = true
    }
  }, [id, isEdit, user])

  const validate = (): string | null => {
    if (!title.trim() || title.trim().length < 3) {
      return 'Назва посади повинна містити щонайменше 3 символи'
    }
    const finalCompanyName = profileCompanyName || companyName.trim()
    if (!finalCompanyName || finalCompanyName.length < 2) {
      return 'Вкажіть назву компанії (щонайменше 2 символи)'
    }
    if (!location.trim() || location.trim().length < 2) {
      return 'Вкажіть локацію (щонайменше 2 символи)'
    }
    if (!industry.trim() || industry.trim().length < 2) {
      return 'Вкажіть сферу або галузь діяльності'
    }
    if (!description.trim() || description.trim().length < 20) {
      return 'Опис вакансії повинен бути детальнішим (щонайменше 20 символів)'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const clientErr = validate()
    if (clientErr) {
      setError(clientErr)
      return
    }

    const payload: VacancyInput = {
      title: title.trim(),
      company_name: (profileCompanyName || companyName).trim(),
      location: location.trim(),
      industry: industry.trim(),
      work_format: workFormat,
      experience: experience,
      description: description.trim(),
      status: status,
    }

    setSubmitting(true)
    try {
      if (isEdit && id) {
        await updateVacancy(id, payload)
      } else {
        await createVacancy(payload)
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти вакансію')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="employer-container">
        <p className="centered">Завантаження форми вакансії…</p>
      </div>
    )
  }

  if (isEdit && error && !title) {
    return (
      <div className="employer-container">
        <Link to="/dashboard" className="back-link">
          ← Повернутися до кабінету
        </Link>
        <div className="empty-state">
          <h2>Доступ обмежено</h2>
          <p>{error}</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
            Роботодавець має право редагувати лише ті вакансії, які створені його компанією.
          </p>
          <Link
            to="/dashboard"
            className="primary"
            style={{ display: 'inline-flex', padding: '0.75rem 1.25rem', borderRadius: 10 }}
          >
            До списку моїх вакансій
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="employer-container">
      <Link to="/dashboard" className="back-link">
        ← Повернутися до кабінету
      </Link>

      <div className="form-card" style={{ maxWidth: 840, margin: '0 auto' }}>
        <h2>{isEdit ? 'Редагувати вакансію' : 'Опублікувати нову вакансію'}</h2>
        <p className="field-hint" style={{ marginBottom: '2rem' }}>
          Заповніть усі обов’язкові поля для публікації пропозиції роботи чи стажування вашої компанії.
        </p>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Title */}
          <div className="field">
            <label htmlFor="title">
              Назва посади <span className="req">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              placeholder="напр. Junior Frontend Developer, Стажер у відділ маркетингу"
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Company & Industry */}
          <div className="form-grid-2">
            <div className="field">
              <label htmlFor="companyName">
                Компанія <span className="req">*</span>
              </label>
              <input
                id="companyName"
                type="text"
                value={profileCompanyName || companyName}
                placeholder="Назва компанії"
                onChange={(e) => setCompanyName(e.target.value)}
                readOnly={Boolean(profileCompanyName)}
                style={profileCompanyName ? { background: 'var(--surface-2)', cursor: 'not-allowed' } : {}}
                required
              />
              {profileCompanyName && (
                <span className="field-hint" style={{ fontSize: '0.75rem' }}>
                  🔒 Закріплено за вашим профілем компанії ({profileCompanyName}).
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="industry">
                Галузь / Сфера діяльності <span className="req">*</span>
              </label>
              <input
                id="industry"
                type="text"
                value={industry}
                placeholder="напр. IT, Маркетинг, Дизайн, Освіта"
                onChange={(e) => setIndustry(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Location & Status */}
          <div className="form-grid-2">
            <div className="field">
              <label htmlFor="location">
                Локація (місто або онлайн) <span className="req">*</span>
              </label>
              <input
                id="location"
                type="text"
                value={location}
                placeholder="напр. Київ, Львів, Онлайн"
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="status">Статус публікації</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as VacancyStatus)}
              >
                <option value="active">Активна (видима в каталозі)</option>
                <option value="closed">Закрита (прийом призупинено)</option>
              </select>
            </div>
          </div>

          {/* Work format radio-cards */}
          <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.45rem' }}>
              Формат роботи <span className="req">*</span>
            </legend>
            <div className="option-cards">
              {(['office', 'remote', 'hybrid'] as WorkFormat[]).map((format) => (
                <label key={format} className="option-card">
                  <input
                    type="radio"
                    name="workFormat"
                    value={format}
                    checked={workFormat === format}
                    onChange={() => setWorkFormat(format)}
                  />
                  <span>{WORK_FORMAT_LABELS[format]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Experience level radio-cards */}
          <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.45rem' }}>
              Рівень досвіду <span className="req">*</span>
            </legend>
            <div className="option-cards">
              {(['none', 'junior', 'middle', 'senior'] as ExperienceLevel[]).map((exp) => (
                <label key={exp} className="option-card">
                  <input
                    type="radio"
                    name="experience"
                    value={exp}
                    checked={experience === exp}
                    onChange={() => setExperience(exp)}
                  />
                  <span>{EXPERIENCE_LABELS[exp]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Description */}
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="description">
                Опис вакансії та вимоги <span className="req">*</span>
              </label>
              <span className={`char-counter ${description.trim().length >= 20 ? 'valid' : ''}`}>
                {description.trim().length} / 20 мін. символів
              </span>
            </div>
            <textarea
              id="description"
              value={description}
              placeholder="Опишіть обов'язки, вимоги до знань кандидата, стек технологій та що ви пропонуєте (навчання, гнучкий графік тощо)..."
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              required
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn-sm"
              onClick={() => navigate('/dashboard')}
              disabled={submitting}
            >
              Скасувати
            </button>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Збереження…' : isEdit ? 'Зберегти зміни' : 'Опублікувати вакансію'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
