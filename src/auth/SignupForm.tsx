import { useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { CompactForm } from '../components/CompactForm';
import { PasswordField } from '../components/PasswordField';
import { ValidationDialog } from '../components/ValidationDialog';
import { passwordError, registrationName, registrationUsername, registrationEmail, validEmail } from '../shared/identity';
export function SignupForm({ onBusyChange, email, onEmailChange }: {
    onBusyChange: (value: boolean) => void;
    email: string;
    onEmailChange: (value: string) => void;
}) {
    const auth = useAuth(), submitting = useRef(false);
    const [step, setStep] = useState(0), [identity, setIdentity] = useState({ username: '', firstName: '', lastName: '' });
    const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false), [errors, setErrors] = useState<string[]>([]), [notice, setNotice] = useState(''), [reset, setReset] = useState(0);
    const passwordIssue = password ? passwordError(password) : '', mismatch = confirmation && confirmation !== password ? 'Passwords do not match.' : '';
    function dismiss() {
        if (step === 0)
            setIdentity(v => ({ ...v, firstName: '', lastName: '' }));
        else if (step === 1) {
            setIdentity(v => ({ ...v, username: '' }));
            onEmailChange('');
        }
        else {
            setPassword('');
            setConfirmation('');
        }
        setErrors([]);
        setReset(v => v + 1);
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.signup-form input:not([disabled])')?.focus());
    }
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (submitting.current || notice)
            return;
        const issues: string[] = [];
        const validate = (action: () => unknown) => { try {
            action();
        }
        catch (e) {
            issues.push((e as Error).message);
        } };
        if (step === 0) {
            validate(() => registrationName(identity.firstName, 'First Name'));
            validate(() => registrationName(identity.lastName, 'Last Name'));
        }
        if (step === 1) {
            validate(() => registrationUsername(identity.username));
            if (!validEmail(email))
                issues.push('Please enter a valid email address.');
        }
        if (step === 2) {
            if (passwordError(password))
                issues.push(passwordError(password));
            if (confirmation !== password)
                issues.push('Passwords do not match.');
        }
        if (issues.length) {
            setErrors([...new Set(issues)]);
            return;
        }
        if (step === 0) {
            setIdentity(v => ({ ...v, firstName: registrationName(v.firstName), lastName: registrationName(v.lastName) }));
            setStep(1);
            return;
        }
        submitting.current = true;
        setBusy(true);
        onBusyChange(true);
        try {
            const input = { username: registrationUsername(identity.username), email: registrationEmail(email) };
            if (step === 1) {
                const check = await auth.services.api<{
                    usernameAvailable: boolean;
                    emailAvailable: boolean;
                }>('/auth/availability', { method: 'POST', body: JSON.stringify(input) });
                const unavailable = [];
                if (!check.usernameAvailable)
                    unavailable.push('This username is already taken. Please choose another.');
                if (!check.emailAvailable)
                    unavailable.push('This email address is already registered.');
                if (unavailable.length) {
                    setErrors(unavailable);
                    return;
                }
                onEmailChange(input.email);
                setIdentity(v => ({ ...v, username: input.username }));
                setStep(2);
                return;
            }
            const provider = auth.services.provider!;
            const { data, error } = await provider.auth.signUp({ email: input.email, password, options: { data: { username: input.username, first_name: identity.firstName, last_name: identity.lastName }, emailRedirectTo: `${location.origin}/auth/callback` } });
            if (error)
                throw error;
            if (data.session)
                await auth.refresh();
            else
                setNotice('Check your email for the verification link before signing in.');
        }
        catch (reason) {
            setErrors([reason instanceof Error ? reason.message : 'Registration could not complete. Please retry.']);
        }
        finally {
            submitting.current = false;
            setBusy(false);
            onBusyChange(false);
        }
    }
    const change = (field: keyof typeof identity, value: string) => setIdentity(v => ({ ...v, [field]: value }));
    return <div className="signup-wizard" data-signup-step={step + 1} aria-label="Three-step sign up">
  <div className="signup-step"><button className="text-button" type="button" disabled={busy || step === 0} onClick={() => setStep(step - 1)}>Back</button><span aria-live="polite">Step {step + 1} of 3 · {['Personal Information', 'Account Information', 'Password'][step]}</span></div>
  <CompactForm key={`${step}:${reset}`} className="signup-form" noValidate onSubmit={submit}>
   {step === 0 && <>
    <label>First Name<input required maxLength={80} autoComplete="given-name" placeholder="First name" value={identity.firstName} onChange={e => change('firstName', e.target.value)}/></label>
    <label>Last Name<input required maxLength={80} autoComplete="family-name" placeholder="Last name" value={identity.lastName} onChange={e => change('lastName', e.target.value)}/></label>
    <p className="field-hint identity-feedback">Your name and @username will be visible to other players.</p>
   </>}
   {step === 1 && <>
    <label>Username<input required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="username" value={identity.username} onChange={e => change('username', e.target.value)}/></label>
    <label>Email address<input required type="email" autoComplete="email" autoCapitalize="none" placeholder="yourmail@provider.com" value={email} onChange={e => onEmailChange(e.target.value)}/></label>
   </>}
   {step === 2 && <><PasswordField data-form-field label="Password" value={password} onChange={setPassword} error={passwordIssue}/><PasswordField data-form-field label="Confirm Password" value={confirmation} onChange={setConfirmation} error={mismatch}/></>}
   {notice && <p className="form-notice signup-message" role="status">{notice}</p>}
   <button className="button button-primary" disabled={busy || !!notice || !auth.configured}>{busy ? (step === 1 ? 'Checking availability…' : 'Creating account…') : step === 2 ? 'Create account' : 'Next'}</button>
  </CompactForm>
  <ValidationDialog errors={errors} onDismiss={dismiss}/>
 </div>;
}
