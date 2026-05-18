# Phase 3 — Operational Runbook

> Lives alongside [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md). This file is
> the "how do I actually run / set up / unbreak Phase 3?" reference. As
> later PRs add capabilities (admin shell, listings, leads journal,
> analytics, admins-of-admins, 2FA), append the matching procedures here
> instead of dumping them into the handoff.

---

## 1. Bootstrap the very first super-admin (PR 3.1)

The admin tier is **invite-only by design** — there is no self-signup, and
the magic-link form refuses to create new `auth.users` rows
(`shouldCreateUser: false` in
[`src/app/[locale]/auth/login/actions.ts`](../src/app/%5Blocale%5D/auth/login/actions.ts)).
That keeps drive-by visitors from seeding accounts, but it also means the
first super-admin must be created manually. Do this once per environment
(local Supabase, then production).

### Step 1 — Add the user to `auth.users`

Two paths:

**Easier path — Supabase Studio.**

1. Open <https://supabase.com/dashboard/project/gvjmnwsqaymkxcsabjur/auth/users>
   (or your local Studio at <http://localhost:54323> for Docker Supabase).
2. Click **Add user → Send invitation** (the green "Send Invitation" button).
3. Enter the admin's email address (e.g. `owner@al-hewal.sa`). Leave
   "Auto-confirm user" checked.
4. Submit. Supabase emails them a sign-in link. **Copy the new user's UUID
   from the user list** — you need it for step 2.

**Power-user path — SQL.**

```sql
-- Run in Supabase SQL Editor. Replace the email.
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values (
  gen_random_uuid(),
  'owner@al-hewal.sa',
  now(),
  '{"provider":"email"}'::jsonb,
  '{}'::jsonb
)
returning id, email;
```

### Step 2 — Insert the matching `public.admins` row

The middleware + `/auth/callback` route both reject sign-ins that don't
have a matching row in `public.admins` with `status='active'`.

```sql
-- Replace the UUID with the one from step 1, and the email/full_name to taste.
insert into public.admins (id, email, full_name, tier, status, language_pref)
values (
  '00000000-0000-0000-0000-000000000000',  -- ← paste the auth.users.id here
  'owner@al-hewal.sa',
  'Al Hewal Owner',
  'super_admin',
  'active',
  'ar'
);
```

### Step 3 — First sign-in

1. Visit `/<locale>/auth/login` (e.g. `https://al-hewal.com/ar/auth/login`).
2. Enter the email. Submit.
3. Open the mail Supabase sent and click the magic link.
4. The link hits `/auth/callback?code=…`, which exchanges the OTP for a
   Supabase session, looks up the `public.admins` row, signs our HMAC
   session cookie (1-hour TTL), and redirects to `/<locale>/admin`.

If anything goes wrong, the callback redirects back to the login page with
`?error=<key>` so the user sees the right message:

| `error` query     | Cause                                    | Fix                |
| ----------------- | ---------------------------------------- | ------------------ |
| `callbackInvalid` | OTP code missing or already consumed     | Request a new link |
| `callbackExpired` | Magic link older than ~1 hour            | Request a new link |
| `notAdmin`        | Authenticated but no active `admins` row | Repeat step 2      |

### Step 4 — Subsequent admins (after PR 3.4)

PR 3.4 ships the in-app super-admin → invite flow. Until then, every new
admin needs the same steps 1+2.

---

## 2. Required environment variables (Phase 3 additions)

| Var                  | Where to set                                                | How to generate                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_COOKIE_SECRET` | `.env` + Vercel (Production + Preview + Development scopes) | 32+ chars of high-entropy random. `openssl rand -hex 32` on bash/WSL/mac, or PowerShell: `-join ((1..64) \| ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })` |

Rotation cadence: quarterly per [`SECURITY.md`](../SECURITY.md). Rotation
forces every active admin to sign in again once — no other side-effects.

In CI, the workflow file at
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) pins a
deterministic test value so the cookie round-trip in
[`tests/unit/lib/auth/session.test.ts`](../tests/unit/lib/auth/session.test.ts)
is reproducible.

---

## 3. Configure Supabase Auth redirect URLs

For magic-link sign-in to land back on the site, the callback URL has to
be allowlisted in the Supabase dashboard.

1. Open <https://supabase.com/dashboard/project/gvjmnwsqaymkxcsabjur/auth/url-configuration>.
2. Add to **Redirect URLs** (Allow List), one per environment:
   - `http://localhost:3000/auth/callback`
   - `https://*.vercel.app/auth/callback` (covers all preview deploys)
   - `https://al-hewal.com/auth/callback` (production — adjust to the real domain)
3. Set **Site URL** to the production domain (`https://al-hewal.com`).
4. Save.

Without this, Supabase rejects the `emailRedirectTo` we pass to
`signInWithOtp` and the magic-link email never sends.

---

## 4. Common breakages

### "401 Unauthorized" from `signInWithOtp`

Almost always the `Redirect URLs` allowlist is missing your callback URL.
Add it (§3) and try again.

### Cookie set but middleware still redirects

The `AUTH_COOKIE_SECRET` value differs between the env that signed the
cookie and the env that verified it. After a rotation, all active admins
must sign in again — clear `alh_admin_sess` and re-sign in. If this
happens unexpectedly, check that Production / Preview / Dev all use the
same secret (or rotate them in lock-step).

### `notAdmin` error on a brand-new admin

The `auth.users` row was created (step 1) but the `public.admins` row was
skipped (step 2). Re-run the insert in step 2.
