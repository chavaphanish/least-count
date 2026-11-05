# Supabase setup for Least Count

No Supabase project exists for this task yet. Guests, rooms, and local practice have been tested independently. Google/email/profile code is implemented and tested with mocked provider responses; it is **not live-provider verified**. Follow these steps in your browser. Do not send passwords or private keys in chat.

## 1. Create the project

1. Open [Supabase](https://supabase.com/dashboard), sign up/sign in, and create an organization if requested.
2. Select **New project**, name it `least-count`, choose a nearby region, and set a strong database password. Keep the password in your password manager; the game does not need it.
3. Wait for the project to become ready.
4. Under the project's Connect dialog or Settings/API/API Keys, copy the **Project URL** (`https://YOUR-PROJECT.supabase.co`) and **publishable key** (`sb_publishable_...`; the legacy `anon` key is also supported). Labels can vary by dashboard version. Do not use a secret or service-role key.

## 2. Create profiles and avatar storage

1. Open **SQL Editor → New query**.
2. Paste the complete contents of [`supabase/migrations/202611050001_profiles.sql`](../supabase/migrations/202611050001_profiles.sql) and run it **once** on this new project. This creates the profiles table, own-profile row policies, profile initialization function, public avatar bucket, and owner-only object write/delete policies.
3. Check that `public.profiles` has Row Level Security enabled and the `avatars` Storage bucket exists with a 2 MB limit and JPG/PNG/WebP allowed MIME types.
4. Keep the policies enabled. The app uses users' verified JWTs, never an administrative bypass key. Avatar images are public by design; do not upload private documents or sensitive images.

## 3. Enable email sign-in and verification

1. Open **Authentication → Sign In / Providers → Email** (or the equivalent Email provider section).
2. Enable email/password sign-in and **Confirm email**. Use a minimum password length of at least eight characters. Do not disable verification to bypass a configuration problem: the Worker requires a verified email.
3. Configure custom SMTP under Authentication email settings for real users. Supabase's default mail service may restrict recipients/rates and is unsuitable as a production delivery assumption. SMTP passwords stay in Supabase.
4. In **Authentication → URL Configuration**, set Site URL to your actual deployed origin, currently `https://least-count.chavaphanish.workers.dev` if that remains your site.
5. Add these redirect URLs (replace the production domain if yours differs):

```text
https://least-count.chavaphanish.workers.dev/auth/callback
https://least-count.chavaphanish.workers.dev/auth/callback?flow=recovery
http://127.0.0.1:5173/auth/callback
http://127.0.0.1:5173/auth/callback?flow=recovery
http://127.0.0.1:4173/auth/callback
http://127.0.0.1:4173/auth/callback?flow=recovery
```

6. Leave email templates using the provider's supported confirmation/recovery links (normally `{{ .ConfirmationURL }}`), so redirect and token exchange remain intact. Test the actual received link.

## 4. Enable Google

1. In Supabase's **Google** authentication provider, copy the provider's displayed callback URL, normally `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
2. Open [Google Cloud Console](https://console.cloud.google.com/), select/create a project, and configure the OAuth consent screen (Google Auth Platform branding/audience).
3. Create an OAuth client of type **Web application**. Add the Supabase callback URL from step 1 as an **Authorized redirect URI**. This is the Supabase callback, not the game's `/auth/callback` URL.
4. If requested, add your deployed game's origin and local test origin as authorized JavaScript origins.
5. Copy the Google client ID and client secret **directly into Supabase's Google provider settings**, enable the provider, and save. Never put the client secret in GitHub, `.dev.vars`, frontend code, or chat.
6. While Google's consent app is in Testing, add your intended test accounts to its audience. Complete Google's publishing/verification requirements before opening access to everyone.

## 5. Connect the Worker

In Cloudflare, open **Workers & Pages → least-count → Settings → Variables and Secrets** (runtime settings):

```text
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Both values are public configuration, returned by `/api/config`; do not substitute secrets. Set the same runtime configuration for the reviewed preview environment if you use one. Use configuration-driven `npx wrangler deploy` after review; if dashboard variables are being overwritten by Git builds, use `npx wrangler deploy --keep-vars`. Review the Worker migration in `wrangler.jsonc` before its first deployment. This task creates a PR, not an automatic production deployment.

For local development only, copy `.dev.vars.example` to `.dev.vars`, replace the two placeholders, and restart `npm run dev:server`. Keep `.dev.vars` out of Git. Start Vite in a second terminal as described in README.

If both values are omitted, guest-only mode remains available with clear disabled registered-account controls. Invalid values or missing database migration produce explicit errors rather than fake accounts. Never configure just one value intentionally.

## 6. Verify the reviewed deployment

These require the real project and cannot be proven by mocks:

- Sign up with a new email. Confirm that the verification email arrives, the unverified account cannot enter rooms, and the verification link returns to the game. Sign in after verification, refresh, then sign out.
- Use **Forgot password?**, open the real recovery email in the same browser that requested it (PKCE), change the password, and sign in again. Expired/invalid links should show a useful error.
- Complete Google consent using an allowed account. Repeat with cancellation and ensure sign-in remains available without losing an invitation.
- Open `/join/ROOMCODE` while signed out; complete email or Google sign-in in the same browser and confirm the room is retained. Cross-browser/device PKCE callbacks may require signing in on the original invitation browser.
- Save a display name, upload/replace/remove a JPG, PNG, or WebP avatar, and refresh. Verify old objects are removed, invalid/oversize files fail, and broken images fall back to initials.
- Using two test users and their own JWTs in Supabase tooling, verify user A cannot read/update user B's private profile or upload/delete in B's avatar folder. Public avatar URLs intentionally remain readable.
- Fill a mixed registered/guest room on separate browsers, verify host-only start and seven-card private hands, then test refresh/reconnect, host departure, timed deadlines, and untimed play. The browser network response must contain only the viewer's hand.

Do not commit test passwords/tokens. If mail or OAuth fails, check Supabase Auth logs, redirect allowlists, Google testing audience, SMTP settings, and browser callback errors. If profiles fail, apply/check the migration and RLS policies. If guests fail too, check the Cloudflare Worker bindings/deployment before troubleshooting Supabase.
