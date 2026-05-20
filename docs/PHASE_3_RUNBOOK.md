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

### Step 1 — Add the user to `auth.users` (with a password)

> **Updated for the email + password flow (PR phase-3-auth-password).**
> Magic-link OTP is deprecated; admins sign in with email + password.
> Supabase's invite email is no longer part of the bootstrap path
> because Supabase Hobby SMTP is unreliable — set the password directly
> via SQL and hand the credentials to the admin out of band.

**Recommended — Supabase Studio → Add user → Create new user.**

1. Open <https://supabase.com/dashboard/project/gvjmnwsqaymkxcsabjur/auth/users>
   (or local Studio at <http://localhost:54323>).
2. Click **Add user → Create new user** (NOT "Send Invitation").
3. Fill the form:
   - **Email**: `owner@al-hewal.sa`
   - **Password**: a strong one — share via your password manager / encrypted channel
   - **Auto-confirm user**: ✅ checked
4. Submit. **Copy the new user's UUID** from the users list — you'll need it for step 2.

**Power-user path — SQL.**

```sql
-- Run in Supabase SQL Editor. Replace the email + password.
insert into auth.users (id, email, email_confirmed_at, encrypted_password,
                        raw_app_meta_data, raw_user_meta_data)
values (
  gen_random_uuid(),
  'owner@al-hewal.sa',
  now(),
  extensions.crypt('ReplaceWithStrongPassword!', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
)
returning id, email;
```

**Resetting an existing admin's password (no email required).**

```sql
update auth.users
   set encrypted_password = extensions.crypt('NewStrongPassword!', extensions.gen_salt('bf')),
       email_confirmed_at = coalesce(email_confirmed_at, now())
 where email = 'owner@al-hewal.sa';
```

This is the canonical recovery path when the admin can't receive
email — bypasses Supabase SMTP entirely.

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
2. Enter the email + password set in step 1. Submit.
3. The action calls `supabase.auth.signInWithPassword`, looks up the
   `public.admins` row, signs the HMAC session cookie (1-hour TTL),
   and redirects to `/<locale>/admin`.

If anything goes wrong, the form surfaces an inline error:

| Error key          | Cause                                           | Fix                                        |
| ------------------ | ----------------------------------------------- | ------------------------------------------ |
| `wrongCredentials` | Email or password incorrect                     | Re-enter; reset via SQL above if forgotten |
| `notAdmin`         | Authenticated but no active `public.admins` row | Re-run step 2                              |
| `supabase`         | Network / Supabase outage                       | Retry; check Vercel logs                   |

If the admin **forgets the password**, two recovery options:

1. **`/<locale>/auth/forgot`** — Supabase emails them a reset link.
   Subject to the same SMTP-reliability issues noted above; OK for
   occasional self-service when email is working.
2. **SQL reset** (from step 1's "Resetting an existing admin's
   password" snippet) — bypasses email entirely. Use this when SMTP
   is flaky.

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

For every Supabase Auth email flow (legacy magic-link, password
recovery, invite acceptance) to land back on the site, the
`redirectTo` URL has to be allowlisted in the Supabase dashboard.

1. Open <https://supabase.com/dashboard/project/gvjmnwsqaymkxcsabjur/auth/url-configuration>.
2. Add to **Redirect URLs** (Allow List), once per environment:
   - **Legacy magic-link (PR 3.1)** — `*/auth/callback`:
     - `http://localhost:3000/auth/callback`
     - `https://*.vercel.app/auth/callback` (covers preview deploys)
     - `https://al-hewal.com/auth/callback` (production — adjust to the real domain)
   - **Invite + password-recovery (PR #34 / #35)** — `*/auth/recovery`:
     - `http://localhost:3000/auth/recovery`
     - `https://*.vercel.app/auth/recovery`
     - `https://al-hewal.com/auth/recovery`
3. Set **Site URL** to the production domain (`https://al-hewal.com`).
4. Save.

Without these, Supabase rejects the `redirectTo` parameter and the
invite / recovery email either never sends or sends with a broken
link. The recovery + invite emails both land on `/auth/recovery`
(Route Handler that does the PKCE exchange in a cookie-write-capable
context) — see PR #34 for the full root-cause writeup.

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

---

## 5. Applying schema migrations (PR 3.X — `inquiry_type`)

Phase 3 introduces an append-only migration `0004_inquiry_type.sql` that
adds a topic classifier to `public.leads` (`'general'` vs `'maintenance'`).
The migration is non-destructive — existing rows backfill to `'general'`
via the column default.

### Local Supabase (Docker)

If your local stack is running (`pnpm supabase status` reports services
up), re-apply the full schema + seed:

```powershell
pnpm supabase db reset
```

`db reset` runs every migration in order from a clean slate, so 0004
lands automatically. Use this for any local schema change — it's the
fastest way to verify migration files don't conflict.

### Remote (linked) Supabase

`db push` ships **only the migrations not yet applied** to the linked
remote project (`gvjmnwsqaymkxcsabjur`).

```powershell
pnpm supabase db push
```

You will see a confirmation prompt listing the migrations that will run.
Read it carefully — it should mention `0004_inquiry_type.sql` and
nothing else if Phase 1/2 migrations were already applied (they are).
Type `Y` to confirm.

The migration takes ~1 second on an empty `leads` table. No downtime.

### Verifying the column was created

```powershell
pnpm supabase db remote query "select column_name, data_type, column_default from information_schema.columns where table_schema = 'public' and table_name = 'leads' and column_name = 'inquiry_type';"
```

Expected output: one row, `inquiry_type | USER-DEFINED | 'general'::inquiry_type`.

### Regenerating database.types.ts (optional but recommended)

Once the remote schema reflects the new column, regenerate the typed
client. **Do NOT use plain `>` redirection in PowerShell** — its default
encoding is UTF-16 LE + CRLF, which Git flags as binary and which ESLint
/ tsc refuse to parse. Use one of these instead:

```powershell
# PowerShell — pipe through Out-File with explicit UTF-8 (no BOM):
pnpm supabase gen types typescript --project-id gvjmnwsqaymkxcsabjur `
  | Out-File -FilePath src/lib/supabase/database.types.ts -Encoding utf8 -NoNewline
```

```bash
# bash / WSL — plain redirection is UTF-8 by default:
pnpm supabase gen types typescript --project-id gvjmnwsqaymkxcsabjur > src/lib/supabase/database.types.ts
```

The repository ships a `.gitattributes` rule (`*.ts text eol=lf`) that
keeps Git consistent across platforms, but Git itself doesn't re-encode
UTF-16 → UTF-8; the regen command is what enforces the encoding.

Once `database.types.ts` is regenerated, the previous `as never` casts at
the insert boundaries (in `src/app/api/leads/route.ts`,
`src/app/api/whatsapp/track/route.ts`, `src/app/api/track/view/route.ts`)
were dropped in the post-3.2 housekeeping PR. `src/lib/audit.ts` still
needs one — the `diff: unknown` parameter never narrows cleanly into the
typed `Json` column — see the comment in that file.

### Rollback

If something is wrong, revert the migration with a SECOND migration —
don't edit `0004_inquiry_type.sql` in place (it's already in the remote
DB's `supabase_migrations.schema_migrations` ledger and editing the file
won't re-run it).

```sql
-- supabase/migrations/0005_inquiry_type_rollback.sql
alter table public.leads drop column inquiry_type;
drop type inquiry_type;
```

Same `pnpm supabase db push` to ship the rollback.

---

## 6. Provisioning Vercel Blob (PR 3.5a — image upload)

The admin property form's image upload (`/api/upload`) writes to Vercel
Blob via the `@vercel/blob` SDK. Without a token configured the route
returns **503 `blob_not_configured`** by design — admins see a real
status, not a 500. Provisioning is a one-time setup per Vercel project.

### Step 1 — Create a Blob store

1. Open https://vercel.com/dashboard → select the **al-hewal** project.
2. Click the **Storage** tab in the top nav.
3. Click **Create Database** → choose **Blob** → click **Continue**.
4. Name the store `al-hewal-images` → choose **Primary region** =
   `Frankfurt (fra1)` (closest hop to Saudi visitors among the EU options).
5. **⚠️ Access mode must be `Public`** — Vercel asks during creation.
   The catalog renders property images via plain `<img src>` tags so
   the bytes MUST be publicly reachable. If you accidentally pick
   `Private`, see the "Recovery" subsection below.
6. Click **Create**. Vercel auto-creates a `BLOB_READ_WRITE_TOKEN`
   environment variable and links it to **all three Vercel environments**
   (Development / Preview / Production) for this project.

#### Recovery: my store is configured as Private

The admin upload form will surface a **503 `blob_store_not_public`**
error chip with the message "Blob store is private; recreate it with
public access." The Vercel runtime log shows:

```
[POST /api/upload] failed [Error]: {"code":null,"message":"Vercel Blob:
Cannot use public access on a private store. The store is configured
with private access."}
```

Access mode is set at store creation and CANNOT be changed in place.
Recovery:

1. Open the existing store in the Vercel dashboard → **Storage**.
2. Settings → **Delete this store**. Confirm (Vercel double-checks).
3. Repeat **Step 1** above, this time choosing **Public**.
4. Re-run `pnpm vercel env pull` locally to refresh
   `BLOB_READ_WRITE_TOKEN` (deleting + recreating the store rotates
   the token).
5. Re-deploy production from the Vercel dashboard so the new token
   propagates. Auto-deploys from `main` will pick it up on the next
   commit too.

No data loss to worry about — the store was empty (the upload bug
prevented any blobs from being written in the first place).

#### Recovery: "Vercel Blob: This store does not exist."

After deleting + recreating the store, the upload chip / Vercel
runtime log shows:

```
[POST /api/upload] failed [Error]: {"code":null,"message":"Vercel Blob:
This store does not exist."}
```

…and the chip reads `(blob_store_not_found)`. The
`BLOB_READ_WRITE_TOKEN` that production is using points at the
deleted store. Setting `.env` / `.env.local` locally does NOT touch
what Production serves.

**Fix it from the Vercel dashboard:**

1. Project → **Settings** → **Environment Variables**.
2. Find every `BLOB_READ_WRITE_TOKEN` row. If multiple exist (one
   per store create), **delete every row** (every scope).
3. Project → **Storage** → the new `al-hewal-images` store →
   **Connect Project** → al-hewal. Vercel re-issues a fresh token
   and links it to Production / Preview / Development automatically.
4. Project → **Deployments** → latest → **⋯** → **Redeploy** →
   uncheck "Use existing Build Cache" → confirm. The new token only
   takes effect on a deploy.
5. Locally, re-run `pnpm vercel env pull .env.local` so dev matches
   prod.

The next upload either succeeds with a 200 OR the chip reports a
different error code that pinpoints the next layer.

### Step 2 — Pull the token into your local `.env`

Local `pnpm dev` needs the same token so admins can test uploads
without a deployed preview. From the project root:

```powershell
# From d:\Work\Projects\AL-Hewal\al-hewal
pnpm vercel env pull .env.local
# Or, if .env is your local convention:
pnpm vercel env pull .env
```

Either command writes every Vercel env var (including the new
`BLOB_READ_WRITE_TOKEN`) into the file. The file is `.gitignored`.

### Step 3 — Verify

Quick sanity check that the env loader sees the token:

```powershell
pnpm exec node -e "console.log('token len:', (process.env.BLOB_READ_WRITE_TOKEN ?? '').length)"
```

Expect a length around 60+ characters (the token is a long
`vercel_blob_rw_...` string). A `length: 0` means the env wasn't
loaded — check the file path you pulled into.

Then start the dev server and hit the route as an admin:

```powershell
pnpm dev
# In another shell, with admin cookie set:
# (the upload UI lands in PR 3.5b — for now this just confirms the gate)
```

The route should **stop returning 503** once the token is present —
the next failure mode is the actual handleUpload + sharp pipeline,
which only fires on a real client upload from PR 3.5b's UI.

### Step 4 — Local-dev webhook caveat

Vercel Blob's client-upload pattern delivers the **`onUploadCompleted`
webhook** to your deployment URL. On `pnpm dev` that's
`http://localhost:3000`, which Vercel **cannot reach**. The browser
upload itself works locally; the post-upload sharp processing only
fires once you test on a Vercel preview deployment or use a tunnel
(e.g. `ngrok http 3000` and set its public URL as the callback).

For PR 3.5a we accept this — the actual upload happy-path testing
moves to a preview deployment when 3.5b's UI lands. CI's E2E suite
only exercises the pre-Blob gates (auth, JSON validity, missing-token
503), which work without a real token.

### Free-tier sanity check

Vercel Blob's Hobby plan includes **5 GB storage** and **100 GB
bandwidth** per month. Each upload produces 2 stored variants (AVIF

- WebP) capped at 2400 px longest edge ≈ ~150–500 KB combined per
  photo. That headroom hosts ~5 000+ property photos comfortably.
  Monitor in the Vercel dashboard → Storage → the store you created.

### Rotating the token

The `BLOB_READ_WRITE_TOKEN` rotates from the same Storage page in
the Vercel dashboard (**Settings** → **Rotate token**). After
rotation re-run `pnpm vercel env pull` locally. Production picks up
the new token on the next deployment automatically.

---

## 7. Applying migration 0005 (PR 3.5b — `property_images.webp_url`)

PR 3.5b adds a nullable `webp_url text` column to `property_images`
so the public `<picture>` element can declare both AVIF and WebP
sources. Old rows (uploaded before 3.5b) leave the column NULL; the
admin gallery + the public catalog both fall back to `blob_url`
(AVIF) when WebP is absent.

### Local (Docker Supabase)

```powershell
Set-Location "d:\Work\Projects\AL-Hewal\al-hewal"
pnpm supabase db reset
```

This wipes the local DB, re-runs every migration (0001 → 0005), and
re-seeds. Then regenerate the typed client:

```powershell
pnpm supabase gen types typescript --local --schema public > src/lib/supabase/database.types.ts
```

Commit the regenerated `database.types.ts` alongside the migration.

### Remote (linked Supabase)

```powershell
pnpm supabase db push
```

Append-only — same rule as 0004. If anything is wrong, ship a 0006
follow-up migration to fix it; never edit 0005 in place after the
remote DB has applied it.

### Verifying the column was created

```powershell
pnpm supabase db diff --linked
```

A clean diff means the local + remote schemas match. After a push,
re-run `pnpm vercel env pull` is NOT required (no env vars
changed).

### Rollback

```sql
-- supabase/migrations/0006_property_images_webp_url_rollback.sql
alter table public.property_images drop column webp_url;
```

`pnpm supabase db push` ships the rollback.

---

## 8. Configure custom SMTP for invite + password-reset emails

Supabase Hobby ships with a built-in SMTP relay that is **rate-limited
to ~30 emails per hour** and frequently silently drops sends. Symptom:
super_admin invites a new admin, the `public.admins` row is created,
but the invitee never receives the email. Same applies to the
`/auth/forgot` password-recovery flow.

The durable fix is to point Supabase Auth at a real transactional
email provider. Resend has a free tier that covers a small admin team
indefinitely (3 000 emails/month, 100/day). SendGrid, Postmark, and
Mailgun all work the same way.

### Step 1 — Provision a Resend account (free tier)

1. https://resend.com/signup — sign up with your team email.
2. Onboarding asks for a **domain**. Two paths:
   - **Recommended (deliverability)**: enter your real domain (e.g.
     `al-hewal.com`), then add the SPF + DKIM DNS records Resend
     prints. Once verified you can send from any address on that
     domain.
   - **Quick start (any address)**: pick `onboarding@resend.dev` —
     no DNS setup, but the From address is `onboarding@resend.dev`
     which is less trustworthy in inbox filters.
3. **API Keys** → **Create API Key** → name it `supabase-smtp` →
   permission `Sending access` → **Create**. Copy the value
   (`re_…`) — Resend only shows it once.

### Step 2 — Plug Resend's SMTP creds into Supabase

1. https://supabase.com/dashboard/project/gvjmnwsqaymkxcsabjur/auth/smtp
2. Toggle **Enable custom SMTP** to **on**.
3. Fill in:
   - **Sender email**: `Al Hewal Admin <invites@al-hewal.com>`
     (or whatever address you verified in Resend).
   - **Sender name**: `Al Hewal`.
   - **Host**: `smtp.resend.com`
   - **Port**: `587`
   - **Username**: `resend`
   - **Password**: the `re_…` key from Step 1.
   - **Minimum interval**: leave at default (60s) — Resend has its
     own rate limits.
4. Click **Save**.

### Step 3 — Verify

Run `/auth/forgot` from a browser with a real admin email. The reset
email should land in the inbox within a few seconds. Failing that,
check:

- Resend dashboard → **Emails** — if Resend received the request,
  Supabase did its part. Resend's UI shows the deliverability outcome.
- Supabase dashboard → **Authentication** → **Logs** — if Supabase
  rejected our SMTP request, the error message is here.

### Step 4 — Customise the templates (optional)

Supabase ships default English templates that say "Confirm your
signup" / "Reset your password". The invite email is fine as-is for
Al Hewal's case, but for the recovery template you'll want to update
the call-to-action URL since the `{{ .ConfirmationURL }}` placeholder
already points at our `redirectTo` (`/auth/recovery?type=…&locale=…`):

1. https://supabase.com/dashboard/project/gvjmnwsqaymkxcsabjur/auth/templates
2. Pick **Invite user** → edit subject/body if you want
   Arabic-bilingual copy.
3. Pick **Reset password** → same.

Leave the link as `{{ .ConfirmationURL }}` — Supabase substitutes the
real `redirectTo` value at send time.

### SQL fallback (still works)

If SMTP is broken AND you need to add an admin immediately, runbook
§1 ("Resetting an existing admin's password") still applies. Insert
the `public.admins` row by hand, then set the auth.users password
via the SQL Editor:

```sql
update auth.users
   set encrypted_password = extensions.crypt('NewStrongPassword!',
                                              extensions.gen_salt('bf')),
       email_confirmed_at  = coalesce(email_confirmed_at, now())
 where email = 'new-admin@al-hewal.sa';
```

Hand the password to the new admin out-of-band.
