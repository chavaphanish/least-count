export function identityFields({
  values,
  onChange,
  message,
}: {
  values: { username: string; firstName: string; lastName: string }
  onChange: (
    field: 'username' | 'firstName' | 'lastName',
    value: string,
  ) => void
  message: string
}) {
  return (
    <>
      <label>
        Username
        <input
          id="identity-username"
          required
          minLength={8}
          maxLength={24}
          pattern="[A-Za-z0-9]{8,24}"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={values.username}
          onChange={(e) => onChange('username', e.target.value)}
          aria-describedby="username-feedback"
        />
      </label>
      <label>
        First Name
        <input
          required
          maxLength={80}
          autoComplete="given-name"
          value={values.firstName}
          onChange={(e) => onChange('firstName', e.target.value)}
        />
      </label>
      <label>
        Last Name
        <input
          required
          maxLength={80}
          autoComplete="family-name"
          value={values.lastName}
          onChange={(e) => onChange('lastName', e.target.value)}
        />
      </label>
      {message && (
        <p
          id="username-feedback"
          className="field-hint identity-feedback"
          role="status"
        >
          {message}
        </p>
      )}
    </>
  )
}
