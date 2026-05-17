# Security Policy — Al Hewal Platform

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public GitHub
issue. Instead, contact the maintainers directly via email and allow up to
72 hours for an initial acknowledgement.

---

## Supply Chain Hardening

Following the September 2025 Shai-Hulud npm worm and earlier `chalk`/`debug`
account compromises, this project enforces a multi-layer defence:

### 1. Postinstall scripts disabled by default

`.npmrc` sets `ignore-scripts=true`. Only packages on the
`pnpm.onlyBuiltDependencies` allowlist in `package.json` are permitted to run
their install scripts (e.g. `sharp`, `esbuild`). Adding a package to the
allowlist requires a PR review.

### 2. Minimum release age

`.npmrc` sets `min-release-age=7d`. pnpm refuses to install package versions
that were published less than 7 days ago. Most malicious publishes are yanked,
flagged, or detected by community scanners within 72 hours, so a 7-day
quarantine catches them before they enter the lockfile.

### 3. Pinned exact versions + frozen lockfile

`package.json` uses exact versions (no `^` or `~`). CI runs
`pnpm install --frozen-lockfile`. Any lockfile change must arrive via a PR
where the diff is reviewed.

### 4. Provenance verification + CVE gate

CI runs `pnpm audit signatures` (verifies npm provenance attestations) and
`pnpm audit --audit-level=high`. High or critical advisories block merges.

### 5. Secret scan pre-commit

A Husky pre-commit hook rejects any staged file containing patterns matching
JWT prefixes (`eyJ...`), Supabase tokens (`sb-...`), Vercel Blob R/W tokens
(`vercel_blob_rw_...`), Google Maps API key assignments, or generic `.env`
contents.

### 6. Socket.dev GitHub App

The repository has the Socket.dev GitHub App installed. It automatically
comments on PRs that introduce risky packages (typosquats, install scripts,
malware indicators, suspicious dependency graphs).

### 7. Auditable additions

`pnpm add` is never run without a written rationale and reviewer approval.
The dependency manifest is reviewed in batches per phase, with each package
checked for maintainer reputation, weekly downloads, last release date, and
known incident history.

---

## Runtime Security

### Authentication

- **Public users:** unauthenticated. No signup. No personal data stored except
  lead submissions.
- **Admins:** invite-only. Super admins generate magic-link invitations via the
  admin dashboard. Invitee follows a one-time, short-lived link to set their
  password. Invitation tokens are stored only as SHA-256 hashes.
- **Two-factor authentication:** TOTP enrolment is **required** for the
  `super_admin` tier and enforced in middleware via the Supabase Auth `aal2`
  check. Optional for `standard_admin`.

### Authorisation

- Supabase Row Level Security is enabled on **every** table, deny-by-default.
- Anonymous role may `select` only live (non-draft, non-deleted) properties and
  their images. May `insert` only into `leads`.
- `standard_admin` may CRUD properties and read leads, but cannot manage other
  admins or read the audit log of other admins.
- `super_admin` has full access including tier changes, hard delete, and audit
  log access.
- The Supabase service role key is used **only** inside `lib/supabase/admin.ts`
  and is guarded by `import 'server-only'`. It is never bundled to the
  browser.

### Input validation

- Every API route validates its body with a Zod `.strict()` schema. Unknown
  fields are rejected.
- Image uploads are validated server-side by magic-byte inspection, dimension
  cap (8000 × 8000), and byte cap (8 MB pre-resize). SVG uploads are **rejected
  outright** (XSS vector). EXIF metadata is stripped.
- Phone numbers are normalised to E.164 via `libphonenumber-js` with KSA
  default region.
- The Google Maps embed URL is constructed server-side from validated `lat` and
  `lng` numeric columns. User-supplied URLs are never passed to an `<iframe>`
  `src`.

### Rate limiting

Upstash Redis (free tier) backs `@upstash/ratelimit`:

| Endpoint | Limit |
|---|---|
| `/api/whatsapp/track` | 10 requests / minute / IP |
| `/api/leads` | 5 requests / minute / IP |
| `/api/invite-admin` | 3 requests / hour / admin |
| `/api/upload` | 30 requests / hour / admin |

### Audit log

Every admin mutation is wrapped in `withAudit(action, entity, handler)` which
writes a row to `admin_audit_log` with the actor's UUID, the action enum,
the entity type and ID, a JSONB before/after diff, and a hashed IP. The audit
log is append-only and visible only to super admins.

### Headers and CSP

The middleware emits a per-request nonce and sets:

- `Content-Security-Policy` with `script-src 'self' 'nonce-<nonce>'`,
  `frame-src https://www.google.com/maps/embed`,
  `img-src 'self' https://*.public.blob.vercel-storage.com data: blob:`,
  `connect-src 'self' https://*.supabase.co https://*.upstash.io`,
  `object-src 'none'`, `base-uri 'self'`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### PII minimisation

IP addresses are never stored raw. They are hashed with a daily-rotated salt
(`ip_hash = sha256(ip + daily_salt)`). Phone numbers are validated and
formatted but not encrypted at rest in Phase 1; Phase 5 evaluates adding
Supabase Vault encryption.

### KSA PDPL compliance

A consent banner is presented to first-time visitors before any
non-essential cookie is set. The visitor-fingerprint cookie used for
deduplicating `page_views` writes is argued as essential under PDPL Article
6(d) (security and abuse prevention) and is included in the privacy policy.

---

## Secret Rotation Schedule

| Secret | Stored in | Rotation cadence | Last rotated |
|---|---|---|---|
| Supabase service role key | Vercel env (Production) | Quarterly | _pending Phase 1 finalisation_ |
| Supabase anon key | Vercel env (Production / Preview / Development) | On suspected compromise only | _pending_ |
| Vercel Blob R/W token | Vercel env (Production) | Quarterly | _pending_ |
| Google Maps API key | Vercel env (Production), restricted by HTTP referrer | Annually or on suspected compromise | _pending_ |
| Upstash Redis token | Vercel env (Production) | Quarterly | _pending_ |
| Sentry DSN | Vercel env (Production) | Annually | _pending_ |
| Resend API key (fallback email) | Vercel env (Production) | Quarterly | _pending_ |
| Daily IP-hash salt | Generated in Supabase via `pg_cron`, never leaves DB | Daily, automatic | n/a |

---

## Incident Response

1. **Detect** — Sentry alert, anomalous lead-rate spike, security advisory, or
   third-party report.
2. **Contain** — disable the affected route via Vercel feature flag if
   possible; rotate the implicated secret immediately.
3. **Investigate** — review `admin_audit_log`, Vercel logs, Supabase logs.
4. **Remediate** — patch and deploy. Verify with a re-run of the failing
   scenario.
5. **Communicate** — notify Al Hewal management within 24 hours of
   confirmation. If personal data is materially exposed, notify the KSA Saudi
   Data and AI Authority (SDAIA) within 72 hours per PDPL Article 20.
6. **Post-mortem** — write a blameless post-mortem in `docs/incidents/` and
   close with an action item list with owners and dates.

---

## Backups

A weekly GitHub Action (`.github/workflows/backup.yml`) runs `pg_dump` against
the production Supabase project, gzips the output, and pushes it to a private
backup repository. Restore drills are run quarterly. The drill procedure is
documented at `docs/runbooks/restore-drill.md` (Phase 5).
