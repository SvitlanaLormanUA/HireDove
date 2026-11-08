import { HeaderTools } from '../components/HeaderTools'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ProfileSection } from '../components/candidate/ProfileSection'
import { ResumeSection } from '../components/candidate/ResumeSection'
import { SavedVacanciesSection } from '../components/candidate/SavedVacanciesSection'
import './employer.css'
import './catalog.css'
import './candidate.css'

export function CandidateDashboardPage() {
  const { logout, logoutAll } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'profile'
  return <div className="employer-container">
    <header className="employer-top-nav"><Link to="/" className="nav-brand">HireDove</Link><div className="btn-group"><HeaderTools /><Link to="/" className="btn-sm">Каталог вакансій</Link><button className="btn-sm" onClick={logout}>Вийти</button><button className="btn-sm" onClick={logoutAll}>Вийти з усіх пристроїв</button></div></header>
    <main>
      <section className="employer-hero"><h1>Кабінет кандидата</h1><p>Ваш профіль, резюме та збережені можливості для початку кар’єри.</p></section>
      <nav className="tabs-nav candidate-tabs" aria-label="Кабінет кандидата">
        {Object.entries({ profile: 'Мій профіль', resume: 'Моє резюме', saved: 'Збережені вакансії' }).map(([key, label]) => <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} aria-current={tab === key ? 'page' : undefined} onClick={() => setParams({ tab: key })}>{label}</button>)}
      </nav>
      {tab === 'resume' ? <ResumeSection /> : tab === 'saved' ? <SavedVacanciesSection /> : <ProfileSection />}
    </main>
  </div>
}
