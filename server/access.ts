import { createClient } from '@supabase/supabase-js';
import { publicConfig } from './auth';
import { ApiError, hash } from './http';
import { passwordError, registrationEmail, registrationName, registrationUsername, username, validEmail } from '../src/shared/identity';
import type { Env } from './types';
const INVALID = 'Invalid email/username or password.';
function clients(env: Env) {
    const config = publicConfig(env).supabase;
    if (!config)
        throw new ApiError(503, 'Registered accounts are not configured yet.');
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url: RequestInfo | URL, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(8000) }) } };
    return { provider: createClient(config.url, config.publishableKey, options), privateClient: () => {
            if (!env.SUPABASE_CAREER_KEY)
                throw new ApiError(503, 'Account validation is being configured. Please retry later.', 'ACCESS_UNAVAILABLE');
            return createClient(config.url, env.SUPABASE_CAREER_KEY, options);
        } };
}
export async function accessLimit(request: Request, env: Env, operation: string) {
    const key = await hash(`${request.headers.get('CF-Connecting-IP') ?? 'local'}:${operation}`);
    const response = await env.DIRECTORY.get(env.DIRECTORY.idFromName(`access:${key}`)).fetch('https://directory/access-limit', { method: 'POST', body: JSON.stringify({ limit: operation === 'availability' ? 40 : 12 }) });
    if (!response.ok)
        throw new ApiError(429, 'Too many attempts. Please wait a few minutes and retry.');
}
function account(input: Record<string, unknown>) {
    try {
        const handle = registrationUsername(input.username);
        const email = typeof input.email === 'string' ? registrationEmail(input.email) : '';
        if (!validEmail(email))
            throw new Error('Please enter a valid email address.');
        return { handle, email };
    }
    catch (e) {
        throw new ApiError(400, (e as Error).message);
    }
}
export async function availability(env: Env, input: Record<string, unknown>) {
    const { handle, email } = account(input);
    const { data, error } = await clients(env).privateClient().rpc('signup_availability', { candidate: handle, address: email });
    if (error || typeof data?.usernameAvailable !== 'boolean' || typeof data?.emailAvailable !== 'boolean')
        throw new ApiError(503, 'Account validation needs the access database migration. Please retry later.', 'ACCESS_UNAVAILABLE');
    return { usernameAvailable: data.usernameAvailable, emailAvailable: data.emailAvailable };
}
export async function login(env: Env, input: Record<string, unknown>) {
    const identifier = typeof input.identifier === 'string' ? input.identifier.trim() : '';
    if (typeof input.password !== 'string' || !input.password || input.password.length > 128 || identifier.length > 254)
        throw new ApiError(401, INVALID);
    const client = clients(env);
    let email = identifier.includes('@') ? registrationEmail(identifier) : '';
    let found = true;
    if (!email) {
        let handle: string;
        try {
            handle = username(identifier);
        }
        catch {
            throw new ApiError(401, INVALID);
        }
        const resolved = await client.privateClient().rpc('resolve_login_email', { candidate: handle });
        if (resolved.error)
            throw new ApiError(503, 'Username sign-in is being configured. Use your email address for now.', 'ACCESS_UNAVAILABLE');
        found = typeof resolved.data === 'string' && !!resolved.data;
        email = found ? resolved.data : 'unknown-login@invalid.example';
    }
    const { data, error } = await client.provider.auth.signInWithPassword({ email, password: input.password });
    if (error || !found || !data.session || !data.user?.email_confirmed_at)
        throw new ApiError(401, INVALID);
    return { session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } };
}
export async function register(request: Request, env: Env, input: Record<string, unknown>) {
    const identity = input.data && typeof input.data === 'object' ? input.data as Record<string, unknown> : {};
    const { handle, email } = account({ username: identity.username, email: input.email });
    let firstName: string, lastName: string;
    try {
        firstName = registrationName(identity.first_name, 'First Name');
        lastName = registrationName(identity.last_name, 'Last Name');
        if (typeof input.password !== 'string' || passwordError(input.password))
            throw new Error(passwordError(typeof input.password === 'string' ? input.password : ''));
    }
    catch (e) {
        throw new ApiError(400, (e as Error).message);
    }
    const check = await availability(env, { username: handle, email });
    if (!check.usernameAvailable)
        throw new ApiError(409, 'This username is already taken. Please choose another.');
    if (!check.emailAvailable)
        throw new ApiError(409, 'This email address is already registered.');
    const origin = request.headers.get('Origin') ?? new URL(request.url).origin;
    const config = publicConfig(env).supabase!;
    if (input.code_challenge !== undefined && (typeof input.code_challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.code_challenge) || input.code_challenge_method !== 's256'))
        throw new ApiError(400, 'Invalid verification request. Reload and retry.');
    let response: Response;
    try {
        response = await fetch(`${config.url}/auth/v1/signup?redirect_to=${encodeURIComponent(`${origin}/auth/callback`)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey }, body: JSON.stringify({ email, password: input.password, data: { username: handle, first_name: firstName, last_name: lastName }, ...(input.code_challenge ? { code_challenge: input.code_challenge, code_challenge_method: input.code_challenge_method } : {}), ...(input.gotrue_meta_security ? { gotrue_meta_security: input.gotrue_meta_security } : {}) }), signal: AbortSignal.timeout(8000) });
    } catch (reason) {
        const timeout = reason instanceof Error && ['TimeoutError', 'AbortError'].includes(reason.name);
        throw signupFailure(0, timeout ? 'request_timeout' : 'connection_failed');
    }
    let data: Record<string, unknown>;
    try {
        const parsed: unknown = await response.json();
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        data = parsed as Record<string, unknown>;
    } catch {
        throw signupFailure(response.status, 'invalid_response');
    }
    const code = typeof data.error_code === 'string' ? data.error_code : typeof data.code === 'string' ? data.code : '';
    const user = data.user && typeof data.user === 'object' ? data.user as Record<string, unknown> : undefined;
    const identities = data.identities ?? user?.identities;
    if (!response.ok || Array.isArray(identities) && identities.length === 0) {
        const failure = signupFailure(response.status, code);
        if (Object.hasOwn(signupErrors, code) || response.status === 429) throw failure;
        // Retain race detection without letting a failed secondary RPC conceal
        // the original provider error. Never retry the account-creation request.
        let recheck;
        try { recheck = await availability(env, { username: handle, email }); }
        catch { throw failure; }
        if (!recheck.usernameAvailable)
            throw new ApiError(409, 'This username is already taken. Please choose another.');
        if (!recheck.emailAvailable || Array.isArray(identities) && identities.length === 0 || ['email_exists', 'user_already_exists'].includes(code))
            throw new ApiError(409, 'This email address is already registered.');
        throw failure;
    }
    if (typeof (user?.id ?? data.id) !== 'string') throw signupFailure(response.status, 'invalid_response');
    return data;
}

const signupErrors: Record<string, [number, string, string]> = {
    weak_password: [400, 'Password does not meet the account security requirements. Choose a stronger password.', 'SIGNUP_WEAK_PASSWORD'],
    email_address_invalid: [400, 'Please enter a valid email address.', 'SIGNUP_INVALID_EMAIL'],
    over_email_send_rate_limit: [429, 'Verification emails are temporarily rate-limited. Please wait before trying again.', 'SIGNUP_EMAIL_RATE_LIMIT'],
    over_request_rate_limit: [429, 'Registration is temporarily rate-limited. Please wait before trying again.', 'SIGNUP_RATE_LIMIT'],
    email_address_not_authorized: [503, 'Verification emails cannot currently be sent to this address. Please contact support.', 'SIGNUP_EMAIL_DELIVERY_UNAVAILABLE'],
    signup_disabled: [503, 'New account registration is currently disabled. Please contact support.', 'SIGNUP_DISABLED'],
    email_provider_disabled: [503, 'Email registration is currently unavailable. Please contact support.', 'SIGNUP_DISABLED'],
    captcha_failed: [400, 'The verification check failed. Reload the page and try again.', 'SIGNUP_CAPTCHA_FAILED'],
    request_timeout: [504, 'Account creation timed out. Check your inbox before trying to register again.', 'SIGNUP_TIMEOUT'],
    connection_failed: [503, 'The account service could not be reached. Please try again later.', 'SIGNUP_UNAVAILABLE'],
};
function signupFailure(status: number, providerCode: string) {
    const reference = crypto.randomUUID();
    const known = Object.hasOwn(signupErrors, providerCode) ? signupErrors[providerCode] : undefined;
    // Only fixed error categories and a random reference are logged. Never log
    // provider messages, request bodies, credentials, email addresses or metadata.
    const code = known || ['unexpected_failure', 'email_exists', 'user_already_exists', 'invalid_response'].includes(providerCode) ? providerCode : 'unknown';
    console.warn(JSON.stringify({ event: 'signup_provider_failure', reference, status, providerCode: code }));
    const [httpStatus, message, appCode] = known ?? (status === 429 ? signupErrors.over_request_rate_limit : [503, 'Account creation is temporarily unavailable. Please try again later.', 'SIGNUP_PROVIDER_ERROR']);
    return new ApiError(httpStatus, known && httpStatus === 400 ? message : `${message} Reference: ${reference}`, appCode);
}
