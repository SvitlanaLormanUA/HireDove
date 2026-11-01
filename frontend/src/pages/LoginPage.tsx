import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AuthLayout } from '../components/AuthLayout'
import { FormAlert, PasswordField, TextField } from '../components/FormControls'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? '/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка входу')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="З поверненням!"
      subtitle="Увійдіть, щоб продовжити пошук або керувати вакансіями."
      footer={<>Немає акаунту? <Link to="/register">Зареєструватися</Link></>}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" required autoFocus
          placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label="Пароль" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <FormAlert>{error}</FormAlert>}
        <button type="submit" className="primary" disabled={submitting || !email || !password}>
          {submitting ? 'Входимо…' : 'Увійти'}
        </button>
      </form>
    </AuthLayout>
  )
}
