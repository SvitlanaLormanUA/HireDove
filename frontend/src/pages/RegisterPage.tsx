import { useState, type ComponentType, type FormEvent, type SVGProps } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, type RegisterData } from '../auth/useAuth'
import { AuthLayout } from '../components/AuthLayout'
import { FormAlert, PasswordField, TextField } from '../components/FormControls'
import { BriefcaseIcon, CheckIcon, GraduationCapIcon } from '../components/Icons'

type Role = RegisterData['role']
type FieldErrors = Partial<Record<'email' | 'password' | 'full_name', string>>

const roles: { value: Role; title: string; description: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { value: 'candidate', title: 'Кандидат', description: 'Шукаю роботу або стажування', Icon: GraduationCapIcon },
  { value: 'employer', title: 'Роботодавець', description: 'Шукаю працівників у команду', Icon: BriefcaseIcon },
]

// Mirrors the backend rules so users get instant feedback; the server still re-checks.
const passwordRules = [
  { label: 'Мінімум 8 символів', test: (p: string) => p.length >= 8 },
  { label: 'Хоча б одна літера', test: (p: string) => /\p{L}/u.test(p) },
  { label: 'Хоча б одна цифра', test: (p: string) => /\d/.test(p) },
]

function validate(data: RegisterData): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.full_name.trim()) errors.full_name = 'Вкажіть імʼя'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Некоректний email'
  if (!passwordRules.every((r) => r.test(data.password))) errors.password = 'Пароль не відповідає вимогам'
  return errors
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<RegisterData>({ email: '', password: '', full_name: '', role: 'candidate' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = <K extends keyof RegisterData>(key: K, value: RegisterData[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key in fieldErrors) setFieldErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const errors = validate(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      await register({ ...form, full_name: form.full_name.trim() })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка реєстрації')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Створіть акаунт"
      subtitle="Це займе менше хвилини."
      footer={<>Вже маєте акаунт? <Link to="/login">Увійти</Link></>}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="role-cards">
          <legend>Хто ви?</legend>
          {roles.map(({ value, title, description, Icon }) => (
            <label key={value} className="role-card">
              <input type="radio" name="role" value={value} className="visually-hidden"
                checked={form.role === value} onChange={() => update('role', value)} />
              <span className="role-icon"><Icon /></span>
              <span className="role-title">{title}</span>
              <span className="role-desc">{description}</span>
              <span className="role-tick"><CheckIcon width={12} height={12} strokeWidth={3} /></span>
            </label>
          ))}
        </fieldset>

        <TextField
          label={form.role === 'employer' ? 'Імʼя контактної особи' : 'Імʼя та прізвище'}
          autoComplete="name" required placeholder="Олена Коваленко"
          value={form.full_name} error={fieldErrors.full_name}
          onChange={(e) => update('full_name', e.target.value)} />
        <TextField
          label={form.role === 'employer' ? 'Робочий email' : 'Email'}
          type="email" autoComplete="email" required placeholder="you@example.com"
          value={form.email} error={fieldErrors.email}
          onChange={(e) => update('email', e.target.value)} />
        <PasswordField
          label="Пароль" autoComplete="new-password" required
          value={form.password} error={fieldErrors.password}
          onChange={(e) => update('password', e.target.value)}
          hint={
            <ul className="password-rules" aria-label="Вимоги до пароля">
              {passwordRules.map((r) => (
                <li key={r.label} className={r.test(form.password) ? 'ok' : ''}>
                  <CheckIcon width={14} height={14} strokeWidth={3} /> {r.label}
                </li>
              ))}
            </ul>
          } />

        {error && <FormAlert>{error}</FormAlert>}
        <button type="submit" className="primary" disabled={submitting}>
          {submitting
            ? 'Створюємо акаунт…'
            : form.role === 'employer' ? 'Зареєструвати компанію' : 'Почати пошук роботи'}
        </button>
      </form>
    </AuthLayout>
  )
}
