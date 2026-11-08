import { useEffect, useState } from 'react'
import {
  APPLICATION_STATUS_LABELS,
  fetchEmployerApplications,
  updateApplicationStatus,
  type ApplicationItem,
  type ApplicationStatus,
} from '../../api/applications'
import { openChatWithApplication } from '../ChatWidget'

export function EmployerApplicationsSection() {
  const [applications, setApplications] = useState<ApplicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedResumeApp, setSelectedResumeApp] = useState<ApplicationItem | null>(null)

  const load = () => {
    setLoading(true)
    fetchEmployerApplications()
      .then((res) => setApplications(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleStatusChange = async (appId: number, newStatus: ApplicationStatus) => {
    try {
      const updated = await updateApplicationStatus(appId, newStatus)
      setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)))
    } catch {
      alert('Не вдалося змінити статус відгуку.')
    }
  }

  if (loading) {
    return <p className="centered">Завантаження отриманих відгуків…</p>
  }

  if (applications.length === 0) {
    return (
      <div className="empty-state">
        <h3>Отриманих відгуків поки немає</h3>
        <p>Коли кандидати відгукнуться на ваші активні вакансії, вони з’являться тут.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {applications.map((app) => (
        <div key={app.id} className="vacancy-manage-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span className="vacancy-manage-company">Вакансія: {app.vacancy_title}</span>
              <h3 style={{ margin: '0.2rem 0' }}>{app.candidate_name}</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{app.candidate_email}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Статус:</label>
              <select
                value={app.status}
                onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                style={{ width: 'auto', margin: 0, padding: '0.35rem 0.6rem' }}
              >
                {(Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {APPLICATION_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {app.cover_letter && (
            <div style={{ background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
              <strong>Супровідний лист:</strong>
              <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap' }}>{app.cover_letter}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="btn-sm"
              onClick={() => setSelectedResumeApp(app)}
            >
              📄 {app.resume ? 'Переглянути резюме' : 'Резюме не додано'}
            </button>

            <button
              type="button"
              className="btn-sm btn-primary"
              onClick={() => openChatWithApplication(app.id)}
            >
              💬 Написати кандидату
            </button>
          </div>
        </div>
      ))}

      {selectedResumeApp && (
        <div className="modal-backdrop" onClick={() => setSelectedResumeApp(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h3>Резюме кандидата: {selectedResumeApp.candidate_name}</h3>
            {selectedResumeApp.resume ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.92rem' }}>
                <div>
                  <strong>Позиція / Заголовок:</strong> {selectedResumeApp.resume.title}
                </div>
                {selectedResumeApp.resume.summary && (
                  <div>
                    <strong>Про себе:</strong>
                    <p style={{ margin: '0.25rem 0 0' }}>{selectedResumeApp.resume.summary}</p>
                  </div>
                )}
                {selectedResumeApp.resume.skills?.length > 0 && (
                  <div>
                    <strong>Навички:</strong> {selectedResumeApp.resume.skills.join(', ')}
                  </div>
                )}
                {selectedResumeApp.resume.languages?.length > 0 && (
                  <div>
                    <strong>Мови:</strong> {selectedResumeApp.resume.languages.join(', ')}
                  </div>
                )}
                {selectedResumeApp.resume.education?.length > 0 && (
                  <div>
                    <strong>Освіта:</strong>
                    <ul style={{ margin: '0.25rem 0', paddingLeft: '1.2rem' }}>
                      {selectedResumeApp.resume.education.map((ed, idx) => (
                        <li key={idx}>
                          {ed.name} — {ed.detail} ({ed.period})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)' }}>Кандидат ще не заповнив детальне резюме у своєму профілі.</p>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-sm" onClick={() => setSelectedResumeApp(null)}>
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}