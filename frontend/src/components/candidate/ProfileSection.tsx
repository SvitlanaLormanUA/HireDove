import { useEffect, useState } from 'react'
import { deleteAvatar, deleteProfile, fetchAvatar, fetchProfile, saveProfile, uploadAvatar, type CandidateProfile, type ProfileWrite } from '../../api/candidate'
import { useAuth } from '../../auth/useAuth'

export function ProfileSection() {
  const { user, refreshUser } = useAuth()
  const empty: ProfileWrite = { full_name: user?.full_name ?? '', phone: '', location: '', education: '', skills: '', description: '' }
  const [form, setForm] = useState(empty)
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [avatar, setAvatar] = useState('')
  const [avatarVersion, setAvatarVersion] = useState(0)
  useEffect(() => {
    let ignore = false
    fetchProfile().then(p => {
      if (ignore) return
      setProfile(p)
      if (p) setForm({ full_name: p.full_name, phone: p.phone, location: p.location, education: p.education, skills: p.skills, description: p.description })
    }).catch(e => { if (!ignore) setLoadError(e.message) }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])
  useEffect(() => {
    let ignore = false
    let url = ''
    if (profile?.has_avatar) fetchAvatar().then(blob => {
      if (!ignore) { url = URL.createObjectURL(blob); setAvatar(url) }
    }).catch(e => { if (!ignore) setError(e.message) })
    return () => { ignore = true; if (url) URL.revokeObjectURL(url) }
  }, [profile?.has_avatar, avatarVersion])
  async function action(work: () => Promise<void>, message: string) {
    if (busy) return
    setBusy(true); setError(''); setSuccess('')
    try { await work(); setSuccess(message) } catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося зберегти зміни') }
    finally { setBusy(false) }
  }
  if (loading) return <p className="centered">Завантаження профілю…</p>
  if (loadError) return <div role="alert" className="alert-box alert-error">{loadError}<button className="btn-sm" onClick={() => window.location.reload()}>Повторити</button></div>
  return <section className="form-card">
    <h2>Мій профіль</h2>
    <p>{user?.email}</p>
    {error && <div role="alert" className="alert-box alert-error">{error}</div>}
    {success && <div role="status" className="alert-box alert-success">{success}</div>}
    <form className="auth-form" onSubmit={e => { e.preventDefault(); void action(async () => {
      setProfile(await saveProfile(form))
      await refreshUser()
    }, 'Профіль збережено') }}>
      <fieldset disabled={busy} className="candidate-fields">
        {(['full_name', 'phone', 'location', 'education', 'skills', 'description'] as const).map(key => <div className="field" key={key}>
          <label htmlFor={`profile-${key}`}>{{ full_name: 'Ім’я та прізвище', phone: 'Телефон', location: 'Місто', education: 'Освіта', skills: 'Професійні навички', description: 'Про себе' }[key]}</label>
          {['education', 'skills', 'description'].includes(key)
            ? <textarea id={`profile-${key}`} maxLength={5000} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
            : <input id={`profile-${key}`} type={key === 'phone' ? 'tel' : 'text'} required={key === 'full_name'} minLength={key === 'full_name' ? 2 : undefined} maxLength={key === 'full_name' ? 255 : key === 'phone' ? 50 : 120} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />}
        </div>)}
      </fieldset>
      <button className="primary" disabled={busy}>{busy ? 'Збереження…' : 'Зберегти профіль'}</button>
    </form>
    {profile && <div className="candidate-avatar">
      <h3>Аватар</h3>
      {profile.has_avatar && avatar && <img src={avatar} alt="Мій аватар" width={96} height={96} />}
      <div className="field"><label htmlFor="avatar">JPEG, PNG або WebP, до 5 МБ / 16 мегапікселів</label>
        <input id="avatar" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (file) void action(async () => {
            if (file.size > 5 * 1024 * 1024) throw new Error('Максимальний розмір — 5 МБ')
            setProfile(await uploadAvatar(file)); setAvatarVersion(v => v + 1)
          }, 'Аватар оновлено')
        }} />
      </div>
      {profile.has_avatar && <button className="btn-sm" disabled={busy} onClick={() => void action(async () => { await deleteAvatar(); setProfile({ ...profile, has_avatar: false }) }, 'Аватар видалено')}>Видалити аватар</button>}
      <button className="btn-sm btn-danger" disabled={busy} onClick={() => {
        if (window.confirm('Видалити додаткові дані профілю та аватар? Резюме й обране залишаться.')) void action(async () => { await deleteProfile(); setProfile(null); setForm(empty) }, 'Дані профілю видалено')
      }}>Видалити дані профілю</button>
    </div>}
  </section>
}
