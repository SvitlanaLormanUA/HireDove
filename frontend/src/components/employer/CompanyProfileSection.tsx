import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { fetchCompanyProfile, saveCompanyProfile, type CompanyProfile } from '../../api/employer'

interface Props {
  onSaved?: () => void
}

export function CompanyProfileSection({ onSaved }: Props) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form states
  const [companyName, setCompanyName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [location, setLocation] = useState('')
  const [industry, setIndustry] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    let ignore = false
    fetchCompanyProfile()
      .then((data) => {
        if (!ignore && data) {
          setProfile(data)
          setCompanyName(data.company_name || '')
          setTagline(data.tagline || '')
          setDescription(data.description || '')
          setWebsite(data.website || '')
          setLocation(data.location || '')
          setIndustry(data.industry || '')
          setCompanySize(data.company_size || '')
          setEmail(data.email || '')
          setPhone(data.phone || '')
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити профіль')
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!companyName.trim()) {
      setError('Назва компанії є обов’язковою')
      return
    }

    setSaving(true)
    try {
      const saved = await saveCompanyProfile({
        company_name: companyName.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        website: website.trim() || null,
        location: location.trim() || null,
        industry: industry.trim() || null,
        company_size: companySize || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      setProfile(saved)
      setSuccess('Профіль компанії успішно оновлено!')
      onSaved?.()
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти профіль')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="centered">Завантаження профілю компанії…</p>
  }

  return (
    <div className="form-card">
      <h2>Профіль компанії</h2>
      <p className="field-hint" style={{ marginBottom: '1.5rem' }}>
        Інформація про вашу компанію, яка буде автоматично додаватися до вакансій та відображатися кандидатам.
      </p>

      {success && <div className="alert-box alert-success">{success}</div>}
      {error && <div className="alert-box alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <div className="form-grid-2">
          <div className="field">
            <label htmlFor="companyName">
              Назва компанії <span className="req">*</span>
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              placeholder="напр. SoftServe, MacPaw, Ajax Systems"
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="industry">Галузь діяльності</label>
            <input
              id="industry"
              type="text"
              value={industry}
              placeholder="напр. IT, Fintech, Маркетинг"
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="tagline">Короткий слоган або слоган компанії</label>
          <input
            id="tagline"
            type="text"
            value={tagline}
            placeholder="напр. Розробляємо інноваційні продукти для всього світу"
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="description">Про компанію</label>
          <textarea
            id="description"
            value={description}
            placeholder="Розкажіть про місію, культуру, переваги роботи у вашій команді..."
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
        </div>

        <div className="form-grid-2">
          <div className="field">
            <label htmlFor="website">Веб-сайт компанії</label>
            <input
              id="website"
              type="url"
              value={website}
              placeholder="https://example.com"
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="location">Головна локація / Місто</label>
            <input
              id="location"
              type="text"
              value={location}
              placeholder="напр. Київ, Львів"
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="field">
            <label htmlFor="companySize">Кількість працівників</label>
            <select
              id="companySize"
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
            >
              <option value="">Не вказано</option>
              <option value="1-10">1–10 працівників</option>
              <option value="11-50">11–50 працівників</option>
              <option value="51-200">51–200 працівників</option>
              <option value="201-1000">201–1000 працівників</option>
              <option value="1000+">1000+ працівників</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="email">Контактний email компанії</label>
            <input
              id="email"
              type="email"
              value={email}
              placeholder="hr@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="phone">Контактний телефон</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            placeholder="+380..."
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Збереження…' : profile ? 'Оновити профіль' : 'Зберегти профіль'}
          </button>
        </div>
      </form>
    </div>
  )
}
