import { useEffect, useState } from 'react'
import { deleteResume, fetchResume, saveResume, type Resume, type ResumeEntry, type ResumeWrite } from '../../api/candidate'

const emptyResume: ResumeWrite = { title: '', summary: '', education: [], experience: [], projects: [], skills: [], languages: [], additional_information: '' }
const sectionLabels = { education: 'Освіта', experience: 'Досвід роботи (необов’язково)', projects: 'Проєкти та досягнення' }
const blankEntry = (): ResumeEntry => ({ name: '', detail: '', period: '', description: '' })

export function ResumeSection() {
  const [resume, setResume] = useState<Resume | null>(null)
  const [form, setForm] = useState<ResumeWrite>(emptyResume)
  const [skills, setSkills] = useState('')
  const [languages, setLanguages] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    let ignore = false
    fetchResume().then(data => { if (!ignore) setResume(data) }).catch(e => { if (!ignore) setLoadError(e.message) }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])
  function startEditing() {
    const data = resume ?? emptyResume
    setForm({ title: data.title, summary: data.summary, education: data.education, experience: data.experience, projects: data.projects, skills: data.skills, languages: data.languages, additional_information: data.additional_information })
    setSkills(data.skills.join('\n')); setLanguages(data.languages.join('\n')); setError(''); setSuccess(''); setEditing(true)
  }
  async function action(work: () => Promise<void>, message: string) {
    if (busy) return
    setBusy(true); setError(''); setSuccess('')
    try { await work(); setSuccess(message) } catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося зберегти резюме') }
    finally { setBusy(false) }
  }
  if (loading) return <p className="centered">Завантаження резюме…</p>
  if (loadError) return <div role="alert" className="alert-box alert-error">{loadError}<button className="btn-sm" onClick={() => window.location.reload()}>Повторити</button></div>
  return <section className="form-card">
    <h2>Моє резюме</h2>
    {error && <div role="alert" className="alert-box alert-error">{error}</div>}
    {success && <div role="status" className="alert-box alert-success">{success}</div>}
    {!editing ? <>
      {resume ? <article className="candidate-resume">
        <h3>{resume.title}</h3><p>{resume.summary}</p>
        {(Object.keys(sectionLabels) as (keyof typeof sectionLabels)[]).map(section => <section key={section}>
          <h3>{sectionLabels[section]}</h3>
          {resume[section].length ? resume[section].map((entry, i) => <div key={i}><h4>{entry.name}</h4><p>{entry.detail} {entry.period}</p><p>{entry.description}</p></div>) : <p className="field-hint">Не вказано</p>}
        </section>)}
        <h3>Навички</h3><p>{resume.skills.join(', ') || 'Не вказано'}</p>
        <h3>Мови</h3><p>{resume.languages.join(', ') || 'Не вказано'}</p>
        <h3>Додаткова інформація</h3><p>{resume.additional_information || 'Не вказано'}</p>
      </article> : <p>Ви ще не створили резюме. Досвід роботи не є обов’язковим — розкажіть про навчання та проєкти.</p>}
      <div className="btn-group">
        <button className="primary" disabled={busy} onClick={startEditing}>{resume ? 'Редагувати резюме' : 'Створити резюме'}</button>
        {resume && <button className="btn-sm btn-danger" disabled={busy} onClick={() => {
          if (window.confirm('Видалити резюме?')) void action(async () => { await deleteResume(); setResume(null) }, 'Резюме видалено')
        }}>Видалити резюме</button>}
      </div>
    </> : <form className="auth-form" onSubmit={e => {
      e.preventDefault()
      const lines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean)
      void action(async () => { setResume(await saveResume({ ...form, skills: lines(skills), languages: lines(languages) }, resume !== null)); setEditing(false) }, 'Резюме збережено')
    }}>
      <fieldset disabled={busy} className="candidate-fields">
        <div className="field"><label htmlFor="resume-title">Назва резюме *</label><input id="resume-title" required minLength={2} maxLength={255} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="resume-summary">Професійний опис</label><textarea id="resume-summary" maxLength={5000} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></div>
        {(Object.keys(sectionLabels) as (keyof typeof sectionLabels)[]).map(section => <section key={section}>
          <h3>{sectionLabels[section]}</h3>
          {form[section].map((entry, index) => <fieldset key={index} className="candidate-entry">
            <legend>{sectionLabels[section]} — {index + 1}</legend>
            {(['name', 'detail', 'period', 'description'] as const).map(key => {
              const id = `${section}-${index}-${key}`
              const update = (value: string) => setForm({ ...form, [section]: form[section].map((item, i) => i === index ? { ...item, [key]: value } : item) })
              return <div className="field" key={key}><label htmlFor={id}>{{ name: section === 'education' ? 'Навчальний заклад *' : section === 'experience' ? 'Організація *' : 'Назва проєкту *', detail: 'Спеціальність / посада / роль', period: 'Період', description: 'Опис' }[key]}</label>
                {key === 'description' ? <textarea id={id} maxLength={5000} value={entry[key]} onChange={e => update(e.target.value)} /> : <input id={id} required={key === 'name'} minLength={key === 'name' ? 2 : undefined} maxLength={key === 'period' ? 120 : 255} value={entry[key]} onChange={e => update(e.target.value)} />}
              </div>
            })}
            <button type="button" className="btn-sm btn-danger" onClick={() => setForm({ ...form, [section]: form[section].filter((_, i) => i !== index) })}>Видалити запис {index + 1}</button>
          </fieldset>)}
          <button type="button" className="btn-sm" disabled={form[section].length >= 30} onClick={() => setForm({ ...form, [section]: [...form[section], blankEntry()] })}>Додати: {sectionLabels[section]}</button>
        </section>)}
        <div className="field"><label htmlFor="resume-skills">Навички — кожна з нового рядка (до 100, до 120 символів кожна)</label><textarea id="resume-skills" maxLength={12100} value={skills} onChange={e => setSkills(e.target.value)} /></div>
        <div className="field"><label htmlFor="resume-languages">Мови та рівень — кожна з нового рядка (до 50, до 120 символів кожна)</label><textarea id="resume-languages" maxLength={6050} value={languages} onChange={e => setLanguages(e.target.value)} /></div>
        <div className="field"><label htmlFor="resume-additional">Додаткова інформація</label><textarea id="resume-additional" maxLength={5000} value={form.additional_information} onChange={e => setForm({ ...form, additional_information: e.target.value })} /></div>
      </fieldset>
      <div className="btn-group"><button className="primary" disabled={busy}>{busy ? 'Збереження…' : 'Зберегти резюме'}</button><button type="button" className="btn-sm" disabled={busy} onClick={() => setEditing(false)}>Скасувати</button></div>
    </form>}
  </section>
}
