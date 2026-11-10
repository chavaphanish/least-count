import { useId, useState } from 'react'
export function PasswordField({
  label,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  'data-form-field'?: boolean
}) {
  const [shown, setShown] = useState(false)
  const errorId = useId()
  return (
    <label>
      {label}
      <span className="password-input">
        <input
          aria-label={label}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          required
          type={shown ? 'text' : 'password'}
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
        <button
          className="password-toggle"
          type="button"
          disabled={disabled}
          aria-label={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {shown && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </span>
      {error && (
        <small id={errorId} className="field-hint">
          {error}
        </small>
      )}
    </label>
  )
}
