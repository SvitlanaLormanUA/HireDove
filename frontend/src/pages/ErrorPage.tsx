import { Link } from 'react-router-dom'

const content = {
  404: {
    title: 'Сторінку не знайдено',
    text: 'Можливо, посилання застаріло або в адресі помилка.',
  },
  403: {
    title: 'Немає доступу',
    text: 'Ця сторінка недоступна для вашого типу акаунту.',
  },
}

export function ErrorPage({ code }: { code: 404 | 403 }) {
  const { title, text } = content[code]
  return (
    <main className="auth-card error-page">
      <p className="error-code">{code}</p>
      <h1>{title}</h1>
      <p>{text}</p>
      <Link to="/" className="button-link">На головну</Link>
    </main>
  )
}
