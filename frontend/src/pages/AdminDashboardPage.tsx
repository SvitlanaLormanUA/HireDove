import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAudit, fetchModerationVacancies, fetchUsers, moderate, type AdminUser, type AuditRecord, type Page } from '../api/administration'
import { VACANCY_STATUS_LABELS, WORK_FORMAT_LABELS, EXPERIENCE_LABELS, type VacancyDetail } from '../api/vacancies'
import { useAuth } from '../auth/useAuth'
import { Pagination } from '../components/catalog/Pagination'
import { HeaderTools } from '../components/HeaderTools'
import { ModuleSelect } from '../components/ModuleSelect'
import './employer.css'
import './catalog.css'
import './admin.css'

const roles = { candidate: 'Кандидат', employer: 'Роботодавець', admin: 'Адміністратор' }
const actions: Record<string, string> = { block_user: 'Блокування користувача', unblock_user: 'Розблокування користувача', hide_vacancy: 'Приховування вакансії', restore_vacancy: 'Відновлення вакансії' }
type Tab = 'users' | 'vacancies' | 'audit'
const tabs: Record<Tab, string> = { users: 'Користувачі', vacancies: 'Вакансії', audit: 'Журнал дій' }

function useList<T>(fetcher: (query: string) => Promise<Page<T>>, query: string, revision: number) {
  const key = `${query}:${revision}`
  const [result, setResult] = useState<{ key: string; data: Page<T> | null; error: string } | null>(null)
  useEffect(() => {
    let ignore = false
    fetcher(query).then(data => { if (!ignore) setResult({ key, data, error: '' }) })
      .catch(e => { if (!ignore) setResult({ key, data: null, error: e instanceof Error ? e.message : 'Помилка завантаження' }) })
    return () => { ignore = true }
  }, [fetcher, query, key])
  return { data: result?.key === key ? result.data : null, loading: result?.key !== key, error: result?.key === key ? result.error : '' }
}

function ModerationButton({ resource, id, action, label, onSuccess }: { resource: 'users' | 'vacancies'; id: number; action: string; label: string; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    setError('')
    const reason = window.prompt(`${label}: вкажіть причину (3–1000 символів)`)?.trim()
    if (reason === undefined) return
    if (reason.length < 3 || reason.length > 1000) { setError('Причина повинна містити 3–1000 символів.'); return }
    if (!window.confirm(`${label} #${id}? Причина: ${reason}`)) return
    setBusy(true)
    try { await moderate(resource, id, action, reason); onSuccess() }
    catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося виконати дію') }
    finally { setBusy(false) }
  }
  return <div><button type="button" className="btn-sm" disabled={busy} onClick={() => void submit()}>{busy ? 'Збереження…' : label}</button>{error && <p role="alert">{error}</p>}</div>
}

function ModerationList({ tab }: { tab: Tab }) {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [secondary, setSecondary] = useState('')
  const [q, setQ] = useState('')
  const [revision, setRevision] = useState(0)
  const [feedback, setFeedback] = useState('')
  const params = new URLSearchParams({ page: String(page) })
  if (q && tab !== 'audit') params.set('q', q)
  if (filter) params.set(tab === 'users' ? 'is_active' : tab === 'vacancies' ? 'is_hidden' : 'action', filter)
  if (secondary) params.set(tab === 'users' ? 'role' : tab === 'vacancies' ? 'status' : 'target_type', secondary)
  const fetcher = (tab === 'users' ? fetchUsers : tab === 'vacancies' ? fetchModerationVacancies : fetchAudit) as (query: string) => Promise<Page<AdminUser | VacancyDetail | AuditRecord>>
  const { data, loading, error } = useList(fetcher, params.toString(), revision)
  const success = () => { setFeedback('Модерацію збережено.'); setRevision(r => r + 1) }
  return <section aria-label={tabs[tab]}>
    <div className="vacancies-toolbar admin-filters">
      {tab !== 'audit' && <label>Пошук за назвою<input type="search" value={q} maxLength={100} onChange={e => { setQ(e.target.value); setPage(1) }} /></label>}
      <ModuleSelect label={tab === 'audit' ? 'Дія' : 'Стан модерації'} value={filter}
        onChange={value => { setFilter(value); setPage(1) }}
        options={[{ value: '', label: 'Усі' }, ...(tab === 'audit'
          ? Object.entries(actions).map(([value, label]) => ({ value, label }))
          : [{ value: tab === 'users' ? 'true' : 'false', label: tab === 'users' ? 'Активні' : 'Видимі' },
            { value: tab === 'users' ? 'false' : 'true', label: tab === 'users' ? 'Заблоковані' : 'Приховані' }])]} />
      <ModuleSelect label={tab === 'users' ? 'Роль' : tab === 'vacancies' ? 'Статус вакансії' : 'Об’єкт'} value={secondary}
        onChange={value => { setSecondary(value); setPage(1) }}
        options={[{ value: '', label: 'Усі' }, ...Object.entries(tab === 'users' ? roles : tab === 'vacancies'
          ? VACANCY_STATUS_LABELS : { user: 'Користувач', vacancy: 'Вакансія' }).map(([value, label]) => ({ value, label }))]} />
      <button type="button" className="btn-sm" disabled={loading} onClick={() => setRevision(r => r + 1)}>Оновити</button>
    </div>
    {feedback && <p role="status">{feedback}</p>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Завантаження…</p>}
    {data && <><p>Знайдено: {data.total}</p>{data.items.length === 0 && <div className="empty-state">Записів немає.</div>}
      <div className="vacancies-manage-list">{data.items.map(item => <article className="vacancy-manage-card" key={item.id}>
        {'full_name' in item ? <>
          <h2 className="vacancy-manage-title">{item.full_name} <small>#{item.id}</small></h2>
          <p>{roles[item.role]} · {item.is_active ? 'Активний' : 'Заблокований'}</p>
          {item.role !== 'admin' && <ModerationButton resource="users" id={item.id} action={item.is_active ? 'block' : 'unblock'} label={item.is_active ? 'Заблокувати' : 'Розблокувати'} onSuccess={success} />}
        </> : 'title' in item ? <>
          <h2 className="vacancy-manage-title">{item.title} <small>#{item.id}</small></h2>
          <p className="vacancy-manage-company">{item.company_name} · {item.location} · {VACANCY_STATUS_LABELS[item.status]} · {item.is_hidden ? 'Прихована модератором' : 'Видима'}</p>
          <details className="admin-vacancy-details"><summary>Деталі вакансії</summary><p>{WORK_FORMAT_LABELS[item.work_format]} · {EXPERIENCE_LABELS[item.experience]} · {item.industry}</p><p className="admin-description">{item.description}</p><p>Роботодавець #{item.employer_id}</p></details>
          <ModerationButton resource="vacancies" id={item.id} action={item.is_hidden ? 'restore' : 'hide'} label={item.is_hidden ? 'Відновити видимість' : 'Приховати'} onSuccess={success} />
        </> : <>
          <h2 className="vacancy-manage-title">{actions[item.action] ?? item.action}</h2>
          <p>Адміністратор #{item.admin_id} · {item.target_type === 'user' ? 'Користувач' : 'Вакансія'} #{item.target_id}</p>
          <p className="admin-description">{item.reason}</p>
          <time>{new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(item.created_at) ? item.created_at : `${item.created_at}Z`).toLocaleString('uk-UA')}</time>
        </>}
      </article>)}</div>
      <Pagination page={page} pages={data.pages} onChange={setPage} />
    </>}
  </section>
}

export function AdminDashboardPage() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('users')
  return <div className="employer-container">
    <header className="employer-top-nav"><Link to="/" className="nav-brand">HireDove</Link><div className="employer-user-meta"><HeaderTools /><span>{user?.full_name}</span><button className="btn-sm" onClick={logout}>Вийти</button></div></header>
    <main>
      <section className="employer-hero"><h1>Панель адміністратора</h1><p>Модерація користувачів і вакансій та журнал адміністративних дій.</p></section>
      <nav className="tabs-nav" aria-label="Адміністрування">{Object.entries(tabs).map(([value, label]) => <button className={`tab-btn ${tab === value ? 'active' : ''}`} aria-current={tab === value ? 'page' : undefined} key={value} onClick={() => setTab(value as Tab)}>{label}</button>)}</nav>
      <ModerationList key={tab} tab={tab} />
    </main>
  </div>
}
