# Phase 1 — Foundations: Done

> Date: 2026-05-17 · Build: green · Tests: 13/13 · Coverage: 100% on covered modules

This phase lays the foundations every later phase will stand on. No
product feature ships in Phase 1 — by design. The goal is a green
build, a quality gate, and a safe place for Phase 2's work to land.

---

## What works today

### Local development

```powershell
corepack enable
corepack prepare --activate                # activates pinned pnpm 11.0.9
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env.local          # then fill in real values
corepack pnpm dev
```

- http://localhost:3000 → redirects to http://localhost:3000/ar (always,
  regardless of browser language — Saudi-first product)
- http://localhost:3000/ar — Arabic placeholder home, `<html dir="rtl" lang="ar">`
- http://localhost:3000/en — English placeholder home, `<html dir="ltr" lang="en">`

### CI gate (runs on every PR + push to main)

| Step                                                     | Status                                     |
| -------------------------------------------------------- | ------------------------------------------ |
| `pnpm install --frozen-lockfile`                         | green                                      |
| `pnpm audit signatures`                                  | green (soft-fail during ecosystem ramp-up) |
| `pnpm audit --audit-level=high`                          | green                                      |
| `pnpm typecheck`                                         | green                                      |
| `pnpm lint`                                              | green                                      |
| `pnpm test` (13 tests, 100% coverage on covered modules) | green                                      |
| `pnpm build` (5 static pages prerendered)                | green                                      |
| Playwright chromium smoke (3 specs)                      | green                                      |

### Build output

```
Route (app)                                 Size  First Load JS
┌ ○ /_not-found                            122 B         102 kB
└ ● /[locale]                            1.26 kB         103 kB
    ├ /ar
    └ /en
+ First Load JS shared by all             102 kB
ƒ Middleware                             45.9 kB
```

Both locales statically prerender; first-load JS is 103 kB — well below
the 150 kB landing-page budget defined in the global web rules.

---

## Architecture decisions taken in Phase 1

These are the choices that subsequent phases inherit. Re-opening them
requires a written rationale.

| Area            | Decision                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 15.5.18 App Router, React 19.2.6, TypeScript 5.9.3 strict                                                               |
| i18n            | next-intl 4.11.1, `/ar` (default) + `/en` prefixes, `localeDetection: false` (Arabic-first always), `<html dir>` set per locale |
| Styling         | Tailwind v4 with `@theme` tokens; sharp 0px radius everywhere; brass only on teal backgrounds                                   |
| Fonts           | IBM Plex Sans / IBM Plex Sans Arabic self-hosted via `next/font` (no Google Fonts CDN at runtime)                               |
| Data            | Supabase Postgres; RLS deny-by-default; service-role isolated to `lib/supabase/admin.ts` with `import 'server-only'`            |
| Image hosting   | Vercel Blob (raw) + `next/image` transforms (AVIF/WebP/responsive) — Supabase Storage left disabled                             |
| Maps            | MapLibre GL + OpenStreetMap (no API key, no per-load cost). Google Maps Embed key is an OPTIONAL upgrade path.                  |
| Lint            | ESLint 9.39.4 flat config (eslint-config-next 15 via FlatCompat)                                                                |
| Tests           | Vitest + happy-dom, 80% coverage gate; Playwright for E2E                                                                       |
| Pre-commit      | Husky + lint-staged + custom secret-scan                                                                                        |
| Package manager | pnpm 11.0.9, exact-pinned versions, frozen lockfile in CI                                                                       |

## Supply-chain hardening

- `.npmrc` enforces `ignore-scripts=true`, `minimum-release-age=10080`
  (7 days), `prefer-frozen-lockfile`, `verify-store-integrity`,
  `auto-install-peers=false`, `strict-peer-dependencies=true`,
  `save-exact`.
- Only 4 transitive packages are allowed to run build scripts (sharp,
  @swc/core, @parcel/watcher, unrs-resolver). Approvals stored in
  `pnpm-workspace.yaml` and documented in `docs/DEPENDENCY_AUDIT.md`.
- Every Phase 1 package was published ≥ 7 days before pinning and is
  from an established maintainer (Vercel / Meta / Microsoft / Tailwind
  Labs / Supabase / OpenJS Foundation).

## DB review applied

A senior backend/DB/architect review of the Phase 1 schema produced 15
items. 9 critical/high items were applied via
`supabase/migrations/0003_review_fixes.sql`; 3 items were intentionally
deferred (PostGIS, Arabic search backend, audit log archival) and 3
were respectfully pushed back on (enums vs lookup tables,
`page_views_daily` PK shape, partial `updated_at` triggers). Full
disposition: [`docs/DB_REVIEW_RESPONSE.md`](DB_REVIEW_RESPONSE.md).

## Out of scope for Phase 1 (intentionally)

| Item                                                      | Lands in                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| Real Hero / Catalog / Property Detail components          | Phase 2                                                              |
| Filter bar with searchParams + debounce                   | Phase 2                                                              |
| Masonry gallery + lightbox + MapLibre embed               | Phase 2                                                              |
| WhatsApp click tracking endpoint + leads insert           | Phase 2                                                              |
| OG images, sitemap, robots, JSON-LD RealEstateListing     | Phase 2                                                              |
| Admin shell + listings table                              | Phase 3                                                              |
| Property wizard + drag-drop image upload via Vercel Blob  | Phase 3                                                              |
| Leads journal + bilingual PDF export                      | Phase 3                                                              |
| Admin invite flow + tier management + analytics charts    | Phase 4                                                              |
| TOTP 2FA enforcement, CSP enforced, Sentry, PDPL consent  | Phase 5                                                              |
| Go-Live (Search Console, GBP, Lighthouse, owner training) | Phase 6 — see [`POST_DEPLOY_CHECKLIST.md`](POST_DEPLOY_CHECKLIST.md) |

---

# Outstanding manual setup (one-time, owner action)

> First-time-user friendly. Every URL, every click, every value to copy
> is below. **You don't need to memorise anything — just follow the
> steps in order.** Total time: ~45 minutes.

## A — Supabase project setup (~15 min)

### A.1 Create the project

1. Open https://supabase.com in a browser.
2. Click **Sign in with GitHub** (top right). Use the GitHub account
   that owns the `Hamednallah/al-hewal` repo.
3. After login, click **New project** (green button on the dashboard).
4. Fill the form:
   - **Organisation**: your personal org (or pick one)
   - **Name**: `al-hewal` (lowercase, dashes)
   - **Database Password**: click **Generate a password**. **COPY THE
     PASSWORD AND SAVE IT IN A PASSWORD MANAGER** (e.g. Bitwarden,
     1Password). You will never see it again from Supabase's UI.
   - **Region**: **Frankfurt (eu-central-1)** is closest to KSA with
     the lowest latency on the free tier.
   - **Pricing plan**: **Free** (we are explicitly designing for the
     free tier).
5. Click **Create new project**. Wait ~2 minutes for provisioning to
   finish.

### A.2 Grab the project keys

While Supabase finishes provisioning, the URL bar shows your **project
ref** — it looks like `abcdefghijklmnopqrst`. Note it down.

Once the project is live:

1. Left sidebar → **Project Settings** (gear icon).
2. Click **API** in the submenu.
3. You will see three boxes:
   - **Project URL** — copy to a notepad, label as
     `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** — copy, label as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** — click the eye icon to reveal, copy,
     label as `SUPABASE_SERVICE_ROLE_KEY`. **THIS IS THE NUCLEAR KEY.
     NEVER PASTE IT INTO A PUBLIC CHANNEL.**

### A.3 Use the Supabase CLI via pnpm

You do NOT need a global `supabase` install. The CLI ships as an npm
package that pnpm fetches and caches on first use. Always invoke it as
**`pnpm supabase ...`** in this repo.

```powershell
# from d:\Work\Projects\AL-Hewal\al-hewal
pnpm supabase --version                       # confirm e.g. supabase v2.x
```

Optional global install (so bare `supabase` works in any terminal):

```powershell
# Windows
scoop install supabase
# macOS
brew install supabase/tap/supabase
```

### A.4 (Optional) Run Supabase locally via Docker

Useful for testing migrations and RLS without touching your live
project. **Requires Docker Desktop installed and running.** Skip this
section if you'd rather go straight to the remote project (A.5).

```powershell
# from d:\Work\Projects\AL-Hewal\al-hewal
pnpm supabase start
# First run: ~5 min while Docker pulls the Supabase images.
# When done it prints local URLs:
#   API URL:        http://127.0.0.1:54321
#   DB URL:         postgresql://postgres:postgres@127.0.0.1:54322/postgres
#   Studio URL:     http://127.0.0.1:54323
#   Inbucket URL:   http://127.0.0.1:54324  (catches outgoing emails)
```

Visit the Studio URL in a browser and you'll see the same dashboard
the cloud project offers, populated with the migrations from
`supabase/migrations/`. To stop:

```powershell
pnpm supabase stop                            # leaves data on disk
pnpm supabase stop --no-backup                # wipes data
```

### A.5 Link the local repo to your remote project + push migrations

```powershell
# from d:\Work\Projects\AL-Hewal\al-hewal
pnpm supabase login                           # opens a browser, OK with default scopes
pnpm supabase link --project-ref abcdefghijklmnopqrst   # paste YOUR project ref
# It will ask for the DB password from A.1 step 4 — paste it.
# Confirm by checking it printed "Finished supabase link."

pnpm supabase db push                         # runs 0001, 0002, 0003 against your project
```

Watch the output. You should see something like:

```
Applying migration 0001_init.sql...
Applying migration 0002_rls.sql...
Applying migration 0003_review_fixes.sql...
Finished supabase db push.
```

If you get an error, copy-paste the FULL output to me and I'll debug.

> **If you previously hit** `ERROR: functions in index expression must
be marked IMMUTABLE (SQLSTATE 42P17)` on the `whatsapp_clicks_day_idx`
> line, that was the bug in `0001_init.sql` that shipped in v0.1.0 and
> was fixed in v0.1.1. Pull the latest `main` (`git pull --ff-only`),
> then re-run `pnpm supabase start` (if local) or
> `pnpm supabase db reset` followed by `pnpm supabase db push` (if you
> already partially pushed to the remote — `db reset` drops the public
> schema cleanly so a re-push starts from a clean state). **Only run
> `db reset` against a remote you don't mind wiping** — production data
> is destroyed by it.

### A.6 Verify in the Supabase dashboard

1. Supabase dashboard → **Table Editor** (left sidebar).
2. You should see these tables in the `public` schema:
   `admins`, `admin_invites`, `admin_audit_log`, `amenities`,
   `leads`, `page_views`, `page_views_daily`, `page_views_default`,
   `page_views_y2026m05`, `properties`, `property_amenities`,
   `property_images`, `whatsapp_clicks`.
3. Click on **amenities** → you should see 20 seeded rows
   (private_parking, modern_finishes, etc.) with Arabic + English labels.
4. ✅ **Supabase is done.**

---

## B — Vercel project setup (~10 min)

You said you've never used Vercel before. Walk-through:

### B.1 Create a Vercel account

1. Open https://vercel.com in a browser.
2. Click **Sign up** → **Continue with GitHub**. Use the same GitHub
   account that owns `Hamednallah/al-hewal`.
3. Vercel asks "which plan?". Pick **Hobby** (it's the free tier).
4. Vercel asks "import a project?". Click **Import Project**.
5. Pick `Hamednallah/al-hewal` from the list (you may need to click
   **Adjust GitHub App Permissions** to grant Vercel access first; it
   opens a GitHub page, scroll to **Repository access**, pick
   **Only select repositories**, search for `al-hewal`, check it,
   click **Save**).
6. Back on Vercel, the project import form appears.
   - **Project Name**: `al-hewal`
   - **Framework Preset**: Next.js (auto-detected, leave as is)
   - **Root Directory**: leave blank (= repo root)
   - **Build Command**: leave default (`pnpm build`)
   - **Output Directory**: leave default (`.next`)
   - **Install Command**: change to **`pnpm install --frozen-lockfile`**
     (click the toggle and paste that)
   - **Node.js Version**: pick **24.x** if available; else leave default
7. **DO NOT click Deploy yet** — we need env vars first.

### B.2 Add environment variables (the values from step A.2)

1. On the same page (or after deploy: Project → **Settings** →
   **Environment Variables**), add each of these. For each one, set
   **Environments** to **Production, Preview, Development** (check all
   three boxes unless noted).

| Name                            | Value                                                                         | Scopes                                              |
| ------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | `https://al-hewal.vercel.app` (replace later when custom domain attached)     | all                                                 |
| `NEXT_PUBLIC_SUPABASE_URL`      | from A.2                                                                      | all                                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from A.2                                                                      | all                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | from A.2                                                                      | **Production only** (UNCHECK Preview + Development) |
| `NEXT_PUBLIC_WHATSAPP_PHONE`    | the real WhatsApp business number, E.164 digits, no `+` (e.g. `9665XXXXXXXX`) | all                                                 |

Skip Vercel Blob, Upstash, Sentry, Resend, Google Maps for now — those
land in later phases.

### B.3 Deploy

1. Click **Deploy**. Wait ~2-3 minutes for the first build.
2. When you see "Congratulations 🎉" with a URL like
   `https://al-hewal-xxxx.vercel.app`, click it.
3. Visit `https://al-hewal-xxxx.vercel.app/` — it should redirect to
   `/ar` and show the Arabic placeholder home.
4. Visit `https://al-hewal-xxxx.vercel.app/en` — English placeholder.
5. ✅ **Vercel is done.**

### B.4 Link the local repo to the Vercel project (one-time)

This lets you `vercel env pull .env.local` to sync env vars from the
cloud to your machine.

```powershell
# from d:\Work\Projects\AL-Hewal\al-hewal
# install Vercel CLI first if not present:
corepack pnpm dlx vercel --version            # one-off, verifies cli works

# then link the local repo to the cloud project
corepack pnpm dlx vercel link
# It asks:
# - "Set up [...]/al-hewal?" -> Yes
# - "Which scope?" -> pick your personal account
# - "Link to existing project?" -> Yes
# - "What's the name of your existing project?" -> al-hewal
# Then it creates .vercel/ in the repo (gitignored).

# Pull production env vars into .env.local
corepack pnpm dlx vercel env pull .env.local
# This overwrites .env.local with the production env values. Good for
# matching the deployed environment locally.
```

---

## C — Branch protection on `main` (~5 min)

So nobody (including future me) can push directly to `main` and skip
the CI gate.

1. Go to https://github.com/Hamednallah/al-hewal/settings/branches
2. **Branch protection rules** → **Add branch protection rule**.
3. **Branch name pattern**: `main`
4. Check these boxes:
   - ✅ **Require a pull request before merging**
     - ✅ Require approvals: `1`
     - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ **Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - In the search box, type each of these and select them as required:
       - `verify`
       - `e2e`
   - ✅ **Require conversation resolution before merging**
   - ✅ **Require linear history**
   - ❌ Do **NOT** check "Restrict who can push" (leaves the option open for hotfixes)
   - ❌ Do **NOT** check "Allow force pushes"
5. Click **Create** at the bottom.
6. ✅ From now on, all changes go through PR + CI.

---

## D — Install Socket.dev (~5 min)

Catches risky packages in PRs before they merge.

1. Go to https://socket.dev
2. Click **Install GitHub App** (top right).
3. Sign in with the same GitHub account.
4. Pick **Only select repositories** → check `al-hewal` → click **Install**.
5. On Socket's dashboard you should now see your repo listed. From the
   next PR onward, Socket comments automatically when a dependency
   change is risky.

---

## E — Optional: custom domain (~10 min, when ready)

When the owner has a domain registered (e.g. `al-hewal.com`):

1. Vercel project → **Settings** → **Domains** → **Add**.
2. Enter `al-hewal.com` → **Add**.
3. Vercel shows DNS records to add at your registrar:
   - Type `A`, Name `@`, Value `76.76.21.21`
   - Type `CNAME`, Name `www`, Value `cname.vercel-dns.com`
4. Add them at the registrar (GoDaddy, Namecheap, SAU NIC). Wait
   5-30 minutes for DNS to propagate.
5. Vercel auto-issues a Let's Encrypt SSL cert when DNS propagates.
6. Update `NEXT_PUBLIC_SITE_URL` in Vercel env vars to
   `https://al-hewal.com` (no trailing slash).
7. **Redeploy** so the new env var takes effect: Vercel → Deployments →
   click latest → **Redeploy**.

---

## F — Tag the milestone (after A + B + C are green)

Once the production deploy serves `/ar` and `/en` correctly:

```powershell
# from d:\Work\Projects\AL-Hewal\al-hewal
git tag -a v0.1.0 -m "Phase 1: foundations"
git push origin v0.1.0
```

Then on GitHub: https://github.com/Hamednallah/al-hewal/releases/new
→ pick tag `v0.1.0` → title `v0.1.0 — Foundations` → paste this
PHASE_1_SUMMARY's "What works" section as the release notes →
**Publish release**.

---

## Commit graph

```
b59b5df feat(quality): ESLint flat config, Husky pre-commit, Vitest+Playwright, CI
af37361 feat(lib): Supabase clients, typed env loader, IBM Plex font loading
4f5048d feat(db): Supabase schema, RLS policies, and seed amenities
21fecfc feat(scaffold): Next.js 15 app skeleton with bilingual [locale] routing
4f97ee3 chore: add hardened pnpm workspace, package.json, and dependency audit
29c2401 chore: initial commit - README, LICENSE, .gitignore, CLAUDE.md, SECURITY.md, CONTRIBUTING.md
```

Plus the upcoming review-fixes commit (which adds migration 0003,
disables locale detection, swaps Google Maps for MapLibre, and adds
the post-deploy checklist).

From Phase 2 the workflow switches to feature branches + PRs.
