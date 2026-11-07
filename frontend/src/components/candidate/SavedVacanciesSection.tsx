import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSaved, removeSaved } from '../../api/candidate'
import type { VacancyCardData } from '../../api/vacancies'
import { VacancyCard } from '../catalog/VacancyCard'

export function SavedVacanciesSection() {
  const [items, setItems] = useState<VacancyCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let ignore = false
    fetchSaved().then(data => { if (!ignore) setItems(data) }).catch(e => { if (!ignore) setError(e.message) }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [reload])
  return <section>
    <h2>Збережені вакансії та стажування</h2>
    {error && <div role="alert" className="alert-box alert-error">{error}<button className="btn-sm" onClick={() => { setLoading(true); setError(''); setReload(v => v + 1) }}>Повторити</button></div>}
    {loading ? <p className="centered">Завантаження…</p> : !error && !items.length ? <div className="form-card"><p>Збережених вакансій поки немає. Зберігайте цікаві позиції у каталозі.</p><Link to="/">Перейти до каталогу</Link></div> : <div className="vacancies-manage-list">
      {items.map(v => <div key={v.id}><VacancyCard vacancy={v} showSave={false} /><button className="btn-sm" disabled={busy !== null} onClick={async () => {
        if (busy !== null) return
        setBusy(v.id); setError('')
        try { await removeSaved(v.id); setItems(items.filter(item => item.id !== v.id)) }
        catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося видалити') } finally { setBusy(null) }
      }}>{busy === v.id ? 'Видалення…' : 'Прибрати з обраного'}</button></div>)}
    </div>}
  </section>
}
