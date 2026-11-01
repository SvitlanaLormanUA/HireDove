import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertIcon, EyeIcon, EyeOffIcon } from './Icons'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: ReactNode
}

export function TextField({ label, error, hint, ...input }: InputProps) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}{input.required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...input} />
      {hint}
      {error && <span id={`${id}-err`} className="field-error">{error}</span>}
    </div>
  )
}

export function PasswordField({ label, error, hint, ...input }: InputProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}{input.required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      <div className="input-with-action">
        <input id={id} type={visible ? 'text' : 'password'} aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined} {...input} />
        <button type="button" className="icon-button" onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Сховати пароль' : 'Показати пароль'}>
          {visible ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
        </button>
      </div>
      {hint}
      {error && <span id={`${id}-err`} className="field-error">{error}</span>}
    </div>
  )
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div className="form-alert" role="alert">
      <AlertIcon width={18} height={18} />
      <span>{children}</span>
    </div>
  )
}
