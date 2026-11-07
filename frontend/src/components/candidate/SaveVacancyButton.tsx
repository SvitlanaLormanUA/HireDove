import { useState } from 'react'
import { saveVacancy } from '../../api/candidate'
import { useAuth } from '../../auth/useAuth'

export function SaveVacancyButton({ vacancyId }: { vacancyId: number }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  if (user?.role !== 'candidate') return null
  return <div>
    <button type="button" className="btn-sm" disabled={busy || saved} onClick={async () => {
      if (busy || saved) return
      setBusy(true); setError('')
      try { await saveVacancy(vacancyId); setSaved(true) }
      catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося зберегти вакансію') }
      finally { setBusy(false) }
    }}>{busy ? 'Збереження…' : saved ? 'Збережено в обраному' : 'Зберегти вакансію'}</button>
    {error && <p role="alert" className="field-error">{error}</p>}
  </div>
}
