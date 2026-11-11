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
    const response = await fetch(`${config.url}/auth/v1/signup?redirect_to=${encodeURIComponent(`${origin}/auth/callback`)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey }, body: JSON.stringify({ email, password: input.password, data: { username: handle, first_name: firstName, last_name: lastName }, ...(input.code_challenge ? { code_challenge: input.code_challenge, code_challenge_method: input.code_challenge_method } : {}), ...(input.gotrue_meta_security ? { gotrue_meta_security: input.gotrue_meta_security } : {}) }), signal: AbortSignal.timeout(8000) });
    const data = await response.json() as Record<string, unknown>;
    const identities = data.identities ?? (data.user as Record<string, unknown> | undefined)?.identities;
    if (!response.ok || Array.isArray(identities) && identities.length === 0) {
        if (data.code === 'weak_password' || data.error_code === 'weak_password')
            throw new ApiError(400, 'Password does not meet the account security requirements. Choose a stronger password.');
        if (data.code === 'email_address_invalid' || data.error_code === 'email_address_invalid')
            throw new ApiError(400, 'Please enter a valid email address.');
        const recheck = await availability(env, { username: handle, email });
        if (!recheck.usernameAvailable)
            throw new ApiError(409, 'This username is already taken. Please choose another.');
        if (!recheck.emailAvailable || Array.isArray(identities) && identities.length === 0)
            throw new ApiError(409, 'This email address is already registered.');
        throw new ApiError(response.status === 429 ? 429 : 400, 'Registration could not complete. Check your details and retry.');
    }
    return data;
}
