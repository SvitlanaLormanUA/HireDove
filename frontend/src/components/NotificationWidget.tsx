import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchNotifications, fetchUnreadCount, readAllNotifications, readNotification, type Notification, type Page } from '../api/administration'
import { fetchVacancyDetail } from '../api/vacancies'
import { useAuth } from '../auth/useAuth'
import { Pagination } from './catalog/Pagination'
import './notifications.css'

export function NotificationWidget() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [data, setData] = useState<Page<Notification> | null>(null)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const refresh = useCallback(async (targetPage = page) => {
    const version = ++request.current
    setLoading(true); setError('')
    try {
      const [list, unread] = await Promise.all([fetchNotifications(targetPage), fetchUnreadCount()])
      if (version === request.current) { setData(list); setCount(unread.count) }
    } catch (e) { if (version === request.current) setError(e instanceof Error ? e.message : 'Не вдалося отримати сповіщення') }
    finally { if (version === request.current) setLoading(false) }
  }, [page])
  useEffect(() => {
    let ignore = false
    fetchUnreadCount().then(result => { if (!ignore) setCount(result.count) }).catch(() => {})
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('focusin', closeOutside)
    root.current?.addEventListener('keydown', closeOnEscape)
    const element = root.current
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('focusin', closeOutside)
      element?.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  async function action(operation: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await operation(); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося оновити сповіщення') }
    finally { setBusy(false) }
  }
  async function follow(item: Notification) {
    await action(async () => {
      await readNotification(item.id)
      // Employer moderation notices lead to their own dashboard, including hidden vacancies.
      if (item.related_type === 'vacancy' && user?.role === 'employer') navigate('/dashboard')
      else if (item.related_type === 'vacancy' && item.related_id) {
        await fetchVacancyDetail(String(item.related_id))
        navigate(`/vacancies/${item.related_id}`)
      } else if (item.related_type === 'user') navigate('/dashboard')
    })
  }
  return <div ref={root} className="notification-widget">
    <button ref={trigger} type="button" className="btn-sm notification-trigger" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => { if (!open) void refresh(); setOpen(!open) }}>
      Сповіщення <span aria-label="Непрочитані">({count})</span>
    </button>
    {open && <section id={panelId} className="notification-panel" aria-label="Ваші сповіщення">
      <h2>Сповіщення</h2>
      <div className="notification-actions">
        <button type="button" className="btn-sm" disabled={loading || busy} onClick={() => void refresh()}>Оновити</button>
        <button type="button" className="btn-sm" disabled={loading || busy || count === 0} onClick={() => void action(readAllNotifications)}>Прочитати всі</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Завантаження…</p> : <>
        {data?.items.length === 0 && <p>Сповіщень поки немає.</p>}
        {data?.items.map(item => <article className={`notification-item${item.read_at ? '' : ' notification-item--unread'}`} key={item.id}>
          <strong>{!item.read_at && <span aria-label="Непрочитане">● </span>}{item.title}</strong>
          <p>{item.message}</p>
          <small>{new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(item.created_at) ? item.created_at : `${item.created_at}Z`).toLocaleString('uk-UA')}</small>
          <div className="notification-actions">
            {!item.read_at && <button type="button" className="btn-sm" disabled={busy} onClick={() => void action(() => readNotification(item.id))}>Прочитано</button>}
            {['user', 'vacancy'].includes(item.related_type ?? '') && <button type="button" className="btn-sm" disabled={busy} onClick={() => void follow(item)}>Переглянути</button>}
          </div>
        </article>)}
        {data && <Pagination page={page} pages={data.pages} onChange={next => { setPage(next); void refresh(next) }} />}
      </>}
    </section>}
  </div>
}
