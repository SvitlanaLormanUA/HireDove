import { Link } from 'react-router-dom'
import { SaveVacancyButton } from '../candidate/SaveVacancyButton'
import { EXPERIENCE_LABELS, WORK_FORMAT_LABELS, type VacancyCardData } from '../../api/vacancies'

// SQLite returns timestamps without a timezone; treat those as UTC.
function parseDate(iso: string): Date {
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`)
}

const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' })

function timeAgo(iso: string): string {
  const diffMin = Math.round((parseDate(iso).getTime() - Date.now()) / 60000)
  const abs = Math.abs(diffMin)
  if (abs < 60) return rtf.format(Math.min(diffMin, 0), 'minute')
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), 'hour')
  return rtf.format(Math.round(diffMin / (60 * 24)), 'day')
}

export function VacancyCard({ vacancy, showSave = true }: { vacancy: VacancyCardData; showSave?: boolean }) {
  return (
    <article className="vacancy-card">
      <header>
        <h2>
          <Link to={`/vacancies/${vacancy.id}`} className="vacancy-title-link">
            {vacancy.title}
          </Link>
        </h2>
        <p className="vacancy-company">{vacancy.company_name}</p>
      </header>
      <ul className="tags" aria-label="Умови">
        <li>{vacancy.location}</li>
        <li>{WORK_FORMAT_LABELS[vacancy.work_format]}</li>
        <li>{EXPERIENCE_LABELS[vacancy.experience]}</li>
        <li>{vacancy.industry}</li>
      </ul>
      <p className="vacancy-snippet">{vacancy.snippet}</p>
      {showSave && <SaveVacancyButton vacancyId={vacancy.id} />}
      <footer>
        <time dateTime={parseDate(vacancy.created_at).toISOString()}>{timeAgo(vacancy.created_at)}</time>
        <Link to={`/vacancies/${vacancy.id}`} className="details-link">
          Детальніше →
        </Link>
      </footer>
    </article>
  )
}
