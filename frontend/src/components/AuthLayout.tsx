import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckIcon, DoveLogo } from './Icons'

const year = new Date().getFullYear()

const perks = [
  'Вакансії та стажування для студентів і випускників',
  'Фільтри за досвідом, форматом і графіком навчання',
  'Пряме спілкування з роботодавцями',
]

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="auth-layout">
      <aside className="auth-brand">
        <Link to="/" className="brand">
          <DoveLogo /> HireDove
        </Link>
        <div className="auth-brand-body">
          <h2>Перша робота починається тут</h2>
          <ul className="perks">
            {perks.map((p) => (
              <li key={p}>
                <span className="perk-check"><CheckIcon width={14} height={14} /></span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-brand-foot">© {year} HireDove</p>
      </aside>

      <main className="auth-main">
        <div className="auth-panel">
          <Link to="/" className="brand brand-mobile">
            <DoveLogo /> HireDove
          </Link>
          <h1>{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
          {footer && <p className="auth-footer">{footer}</p>}
        </div>
      </main>
    </div>
  )
}
