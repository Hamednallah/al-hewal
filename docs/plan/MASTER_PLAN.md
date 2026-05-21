# Al Hewal — Implementation Plan

> **Status — 2026-05-18**
> Phase 1 ✅ shipped (`v0.1.1`) · Phase 2 ✅ shipped (`v0.2.0`)
> Phase 3 (Admin Command Center) next. PR breakdown lives in
> [`../SESSION_HANDOFF.md`](../SESSION_HANDOFF.md) §3.
> What actually landed per phase:
> Phase 1 → [`../PHASE_1_SUMMARY.md`](../PHASE_1_SUMMARY.md);
> Phase 2 → [`../PHASE_2_SUMMARY.md`](../PHASE_2_SUMMARY.md).
> This plan file is the source of intent — phase summaries are the
> source of truth for what shipped vs what was deferred.

## Context

Al Hewal is a Saudi real-estate developer that wants a production-grade bilingual (AR/EN) corporate website to showcase residential projects, capture WhatsApp leads (the primary conversion metric), and give administrators a Command Center for inventory, leads, and analytics. The Google Stitch mockups (10 screens) and the locked design system in `stitch_alhewal_bilingual_corporate_website/al_hewal_architectura/DESIGN.md` are the visual source of truth — sharp 0px corners, Forest Teal #002B2B + Brass #D4B982 palette, IBM Plex Sans / IBM Plex Sans Arabic, asymmetric architectural grid. The deliverable goes to a real KSA client and will be reviewed by a strict senior lead; "exact design, clean architecture, robust testing" is non-negotiable.

We are building everything on free tiers (Supabase, Vercel, Vercel Blob, Google Maps $200 credit) so the plan must respect those quotas at every layer.

**Target build directory:** `d:\Work\Projects\AL-Hewal\al-hewal\` (empty)
**Remote:** https://github.com/Hamednallah/al-hewal.git
**Reference assets:** `d:\Work\Projects\AL-Hewal\stitch_alhewal_bilingual_corporate_website\`

---

## Locked Stack

| Layer            | Choice                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | **Next.js 15 App Router** (React 19, TypeScript strict, `pnpm`)                                                                                                                                    |
| Styling          | **Tailwind v4** with `@theme` tokens + **shadcn/ui (Radix)** fully re-themed                                                                                                                       |
| i18n             | **next-intl** with `/ar` (default) and `/en` path prefixes; RTL via `<html dir>` per route; **public AND admin both bilingual** via `public.*` and `admin.*` namespaces in `messages/{ar,en}.json` |
| Database         | **Supabase Postgres** + RLS + `pg_cron`                                                                                                                                                            |
| Auth             | **Supabase Auth** — magic-link admin invites only, no public signup, TOTP required for `super_admin`                                                                                               |
| Image storage    | **Vercel Blob** raw store; `next/image` does AVIF/WebP transform + responsive srcset                                                                                                               |
| Image processing | `sharp` server-side: max 2560px, AVIF/WebP variants, strip EXIF, reject SVG                                                                                                                        |
| Maps             | **Google Maps Embed API** (free, unlimited per docs), lazy-loaded                                                                                                                                  |
| Lead tracking    | API route → insert leads + whatsapp_clicks rows → 302 redirect to `wa.me`                                                                                                                          |
| Charts           | Recharts (KPI/line/bar), bespoke SVG for KSA region heatmap                                                                                                                                        |
| Forms            | React Hook Form + Zod resolver                                                                                                                                                                     |
| Testing          | **Vitest + RTL** (unit/integration), **Playwright** (E2E + axe-core), 80% coverage gate                                                                                                            |
| Observability    | Sentry (5k errors/mo free), Vercel Logs, custom `page_views` table                                                                                                                                 |
| Rate limit       | Upstash Redis free tier (`@upstash/ratelimit`)                                                                                                                                                     |
| Email            | Supabase Auth built-in for invites; Resend free tier as fallback                                                                                                                                   |
| CI               | GitHub Actions: typecheck, lint, vitest+coverage, playwright smoke, build                                                                                                                          |

---

## Functional Scope

**Public (bilingual, RTL/LTR):**

1. Home — hero, value-prop grid, featured projects carousel, trust banner, footer
2. Catalog — sticky filter bar (type/price/location/search), 3-col grid, status badges, pagination
3. Property Detail — masonry gallery + lightbox, bilingual brief, amenities checklist, sticky contact card, Google Maps embed, fixed mobile WhatsApp/Call bar
4. About, Contact, 404/500

**Admin (bilingual AR/EN, invite-only):**
Same `/ar/admin/...` and `/en/admin/...` route prefixes as the public site. Per-admin `language_pref` column on `admins` stored on the user row; admin sidebar shows a language switcher; default to the admin's saved preference on login. RTL applied via `<html dir>` exactly as on the public side. All admin labels live in `messages/{ar,en}.json` under an `admin.*` namespace; tables, wizards, charts, KPI cards, audit-log diff labels, and email templates (invite, password reset) all have both translations. Date/number formatting uses the locale's `Intl` defaults (Arabic-Indic numerals optional via a per-admin toggle, default Western digits to stay legible in tables).

5. Strategic Analytics — KPI cards, lead-velocity line chart, hottest-properties bar chart, KSA region heatmap
6. Listing Management — paginated table, row-hover actions, search/filter, soft-delete
7. Add/Edit Property — 3-step wizard (basic info → gallery → location/specs), bilingual title fields, drag-drop upload, amenities checkbox grid, draft autosave
8. Leads Journal — chronological timeline, per-property filter, bilingual PDF export
9. Admin Management — tier badges, promote/deactivate, last login
10. Add New Admin — avatar, name, email, tier radio cards, "Generate Invitation Link"
11. My Profile — identity, stats, recent activity, security/2FA settings

---

## Source Control & Git Workflow

Phase 0 (before any code) — repository hygiene:

1. **Initialise the repo inside `al-hewal/`** (currently empty): `git init -b main`, configure local `user.name` / `user.email` per the user's git config, and add `.gitignore` (Next.js + Node + OS + Supabase + IDE entries: `.next/`, `node_modules/`, `coverage/`, `.env*` except `.env.example`, `playwright-report/`, `test-results/`, `.vercel/`, `.DS_Store`, `Thumbs.db`).
2. **Connect origin:** `git remote add origin https://github.com/Hamednallah/al-hewal.git`. Verify the remote is the empty repo from `git-repo.txt`. If origin already has anything, **stop and ask** before any forced operation.
3. **Branch protection:** the `main` branch is the deployable trunk. All feature work happens on short-lived branches `feat/...`, `fix/...`, `chore/...`, `docs/...`, `test/...`, merged via PRs. Direct push to `main` is forbidden after the initial scaffolding commit.
4. **Conventional Commits** for every commit (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`, `build:`). Commit attribution is disabled globally per user settings — no co-author trailers.
5. **Commit cadence:** one logical change per commit, signed off with a body that explains _why_. Never bundle unrelated changes. Never commit generated files (`.next/`, `coverage/`, types from `supabase gen types` are checked in but regenerated by CI).
6. **PR cadence:** one PR per phase **sub-task**, not one giant PR per phase. Each PR includes: scope, screenshots/recordings for UI work, test plan checklist, free-tier impact note, and links to any new env vars added.
7. **PR checks (required to merge):** typecheck, lint, `vitest --coverage` ≥ 80%, Playwright smoke (Chromium), build, `pnpm audit --audit-level=high`, secret-scan, RLS test. All defined in `.github/workflows/ci.yml`.
8. **Husky pre-commit hooks:** `lint-staged` runs Prettier + ESLint on staged files; a Bash secret-scan rejects commits containing `eyJ` (JWT prefix), `sb-` (Supabase tokens), `vercel_blob_rw_`, `GOOGLE_MAPS_API_KEY=...` literal values, or anything matching `.env`. **Hooks are never bypassed** (`--no-verify` is forbidden); a failing hook means fix the underlying issue.
9. **Initial commits (Phase 1 order):**
   - `chore: initial commit — README, LICENSE, .gitignore, CLAUDE.md, SECURITY.md`
   - `chore: scaffold Next.js 15 + TS strict + pnpm + Tailwind v4`
   - `chore: configure ESLint + Prettier + Husky + lint-staged`
   - `feat(i18n): wire next-intl with /ar default and /en prefix + RTL`
   - `feat(ui): re-theme shadcn primitives to Al Hewal palette (sharp 0px, teal/brass)`
   - `feat(db): supabase init + migration 0001_init.sql`
   - `feat(db): migration 0002_rls.sql + seed amenities`
   - `feat(auth): supabase client/server/admin helpers + middleware admin guard`
   - `ci: github actions for typecheck, lint, test, build, playwright`
   - `chore: vercel link + .env.example + secrets documented`
10. **Tags & releases:** at the end of each phase, tag `v0.<phase>.0` (e.g. `v0.1.0` after Phase 1). Cut a GitHub Release with a short changelog. The KSA reviewer can pull any tag to a fresh machine and verify behaviour deterministically.
11. **Backups:** weekly `pg_dump` workflow (`.github/workflows/backup.yml`) pushes a gzipped dump to a private repo `al-hewal-backups` (or Cloudflare R2 free tier). Restore drill documented in `SECURITY.md`.
12. **Secret rotation log:** `SECURITY.md` carries a table of secrets and last-rotated date — Supabase service role, Vercel Blob R/W token, Google Maps API key, Upstash Redis token, Sentry DSN, Resend API key.

---

## Folder & Route Structure

```
al-hewal/
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql           # enums + core tables
│   │   ├── 0002_rls.sql            # RLS policies + seeded amenities
│   │   ├── 0003_views.sql          # materialized views for analytics
│   │   └── 0004_cron.sql           # pg_cron jobs (nightly rollup, MV refresh)
│   └── config.toml
├── src/
│   ├── middleware.ts               # next-intl + admin guard (signed-cookie cached)
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (public)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                       # home, ISR revalidate=3600
│   │   │   │   ├── properties/
│   │   │   │   │   ├── page.tsx                   # catalog
│   │   │   │   │   └── [slug]/
│   │   │   │   │       ├── page.tsx               # ISR + on-demand revalidate
│   │   │   │   │       └── opengraph-image.tsx
│   │   │   │   ├── about/page.tsx
│   │   │   │   ├── contact/page.tsx
│   │   │   │   ├── sitemap.ts
│   │   │   │   └── robots.ts
│   │   │   ├── (admin)/admin/
│   │   │   │   ├── layout.tsx                     # force-dynamic, auth+admin check
│   │   │   │   ├── page.tsx                       # → /admin/analytics
│   │   │   │   ├── analytics/page.tsx
│   │   │   │   ├── listings/{page,new/page,[id]/edit/page}.tsx
│   │   │   │   ├── leads/page.tsx
│   │   │   │   ├── admins/{page,new/page}.tsx
│   │   │   │   └── profile/page.tsx
│   │   │   └── auth/{login,callback,invite/[token]}/...
│   │   ├── api/
│   │   │   ├── whatsapp/track/route.ts            # POST → lead+click → 302 wa.me
│   │   │   ├── leads/route.ts                     # contact form
│   │   │   ├── track/view/route.ts                # sendBeacon endpoint
│   │   │   ├── upload/route.ts                    # signed Blob URL, sharp pipeline
│   │   │   ├── upload/delete/route.ts
│   │   │   ├── invite-admin/route.ts              # super_admin only
│   │   │   └── revalidate/route.ts                # on-demand tag revalidation
│   │   ├── global-error.tsx
│   │   ├── not-found.tsx
│   │   └── manifest.ts
│   ├── i18n/{request.ts, messages/{ar,en}.json}
│   ├── lib/
│   │   ├── supabase/{server,client,admin,database.types}.ts
│   │   ├── blob.ts                                # @vercel/blob + sharp
│   │   ├── ratelimit.ts                           # @upstash/ratelimit
│   │   ├── audit.ts, geo.ts, csp.ts, whatsapp.ts
│   │   └── validators/{property,lead,admin}.ts    # Zod
│   ├── components/
│   │   ├── public/{Hero,ValueGrid,FeaturedCarousel,PropertyCard,FilterBar,Masonry,Lightbox,StickyMobileCTA,LangSwitcher,Footer,Nav}.tsx
│   │   ├── admin/{AdminShell,Sidebar,DataTable,KpiCard,LeadTimeline,PropertyWizard,InviteForm,Charts/*}.tsx
│   │   └── ui/...                                 # shadcn primitives, re-themed
│   └── styles/globals.css                         # @theme tokens, fonts
├── tests/
│   ├── unit/...
│   ├── integration/{rls.test.ts, api/*.test.ts}
│   └── e2e/{public,admin,a11y}.spec.ts
├── public/{icons,fonts(subset)/...}
├── .github/workflows/{ci.yml, deploy-supabase.yml, backup.yml}
├── next.config.ts, tailwind.config (v4 inline), tsconfig.json, eslint.config.js
├── .env.example                                    # all required vars documented
└── README.md, CLAUDE.md, SECURITY.md
```

---

## Database Schema (high-level)

Migration `0001_init.sql` creates:

- **enums:** `property_type`, `property_status`, `lead_source`, `admin_tier`, `admin_status`, `audit_action`
- **`properties`** — bilingual title/description, type, status, price, area, beds, baths, city, district, plot/street/facade, lat/lng, `google_maps_url`, `hero_image_id`, `featured`, denormalized `view_count_total`, generated `search_vector tsvector` (GIN), soft-delete `deleted_at`, audit `created_by/at`, `updated_at`. **One slug per locale** (shared) to keep locale switcher trivial.
- **`property_images`** — `blob_url`, `blob_pathname`, `width/height`, `blurhash`, NOT NULL `alt_ar`/`alt_en`, `position`, `bytes`
- **`amenities`** (lookup, seeded) + **`property_amenities`** (join)
- **`admins`** — FK to `auth.users.id`, `tier`, `status`, `last_login_at`, `language_pref`
- **`admin_invites`** — `email`, `tier`, `invited_by`, `token_hash` (sha256), `expires_at`, `consumed_at`, unique pending invite per email
- **`leads`** — `property_id` (nullable), `source`, name/phone/message (nullable for WhatsApp clicks), `locale`, `ip_hash` (NEVER raw IP), `user_agent`, `referrer`, geo from Vercel headers
- **`whatsapp_clicks`** — 1:1 mirror of WhatsApp leads for fast analytics joins
- **`page_views`** — partitioned monthly; nightly rollup into `page_views_daily(date, property_id, locale, country, count)`; raw rows pruned > 30 days
- **`admin_audit_log`** — every admin mutation: actor, action, entity, jsonb diff

Migration `0002_rls.sql` enables RLS on **every** table, deny-by-default. Anon may `select` only live properties / live images / amenities; may `insert` only into `leads`. Service-role-only inserts on `page_views` and `whatsapp_clicks` (via API routes). `standard_admin` gets CRUD on properties/leads but no admin-table writes. `super_admin` gets full access including tier changes and hard-delete. Integration test in CI uses the anon key and asserts `select * from admins`/`admin_audit_log`/`admin_invites` returns zero rows.

---

## Free-Tier Discipline (baked into the plan, not bolted on)

| Quota                          | Cap                                   | Mitigation built in from Day 1                                                                                                                                               |
| ------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel bandwidth (100GB)       | hero images dominate                  | `sharp` resize at upload to 2560px max + 1600/1024/640 srcset, AVIF first, `priority` on hero only, `immutable` Cache-Control on Blob URLs                                   |
| Function invocations (100k)    | analytics writes per pageview         | `sendBeacon` only on detail page (not every page), dedupe via daily-rotated visitor cookie in middleware, ISR/Edge reads bypass functions on cache hit                       |
| Vercel Blob (5GB / 1GB egress) | 50 properties × 15 imgs × 2MB = 1.5GB | per-property image cap (default 20), reject uploads > 8MB pre-resize, store only resized variants, delete originals, always serve via `<Image>` so Vercel CDN absorbs egress |
| Google Maps Embed              | $200/mo credit                        | use Embed API (free unlimited) not JS Maps API; render `<iframe loading="lazy">`, click-to-load on mobile, intersection-load on desktop                                      |
| Supabase DB (500MB)            | `page_views` grows fast               | partition `page_views` monthly, nightly rollup to `page_views_daily`, prune raw > 30 days                                                                                    |
| Supabase egress (2GB)          | analytics queries                     | materialized views refreshed by `pg_cron` every 15 min; dashboard reads MVs only                                                                                             |
| Abuse / scraping               | unbounded queries                     | hard cap `limit=12, max page=50`, `search` length capped 100 chars, Upstash rate limits on every mutating endpoint                                                           |

---

## Top 10 a11y + RTL Traps (pre-empted)

1. `<html dir>` and `lang` set per route from `params.locale`, not globally
2. **Logical CSS only** — `ms-*/me-*/ps-*/pe-*/start-*/end-*`; audit every imported shadcn component for `ml-*/mr-*` and rewrite
3. Mirror chevrons/arrows in RTL (`rtl:rotate-180`)
4. Masonry gallery uses CSS Grid with explicit areas (DOM order = visual order) for sane tab focus
5. Lightbox: Radix Dialog, Esc + arrow keys, focus trap, return focus, announce "3 of 12"
6. Color contrast rule: **brass is decorative only or sits on teal**; never brass body text on off-white (fails AA at 1.9:1)
7. `alt_ar` + `alt_en` NOT NULL columns; serve alt per current locale
8. `hreflang` `ar-SA` / `en` / `x-default` on every public page + canonical per locale
9. Number inputs in RTL forms: `inputMode="numeric"` + `dir="ltr"` on the input, visible `<label>`, `aria-describedby` for errors
10. Mobile sticky WhatsApp bar: `<main>` gets `padding-block-end: 80px`; bar uses `role="region" aria-label=`; `tel:` real link; WhatsApp is `<a>` not `<button>` (works without JS); respects `prefers-reduced-motion`

Bonus: `:lang(ar)` selector overrides line-height to 1.8 (vs 1.6 Latin) for IBM Plex Sans Arabic.

---

## Security Checklist (specific to this app)

- RLS on every table, deny-by-default, CI test with anon key
- Service-role key only in `lib/supabase/admin.ts` guarded by `import 'server-only'`
- Zod `.strict()` schemas at every API entrypoint
- CSRF: verify `Origin` header on every mutating route
- Rate limits: `/api/whatsapp/track` 10/min/IP, `/api/leads` 5/min/IP, `/api/invite-admin` 3/hr/admin, `/api/upload` 30/hr/admin
- `withAudit(action, entity)` wrapper on every admin mutation → `admin_audit_log` with before/after jsonb diff
- Pre-commit secret scan (regex for `eyJ`, `sb-`, `vercel_blob_rw_`)
- CSP with per-request nonce in middleware; HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy denying camera/mic/geo
- **SSRF on Maps:** never pass user URL to `<iframe src>`. Construct embed URL server-side from validated lat/lng numbers
- Magic-link invites: store sha256 token only, 24h expiry, single-use, invalidate prior pending invites, throttle per inviter
- Image upload: magic-byte validation, 8000×8000 max, 8MB max pre-resize, **reject SVG entirely** (XSS), strip EXIF
- PII minimization: hash IP with daily-rotated salt; phone numbers via `libphonenumber-js` E.164
- TOTP 2FA required for `super_admin`, optional for `standard_admin`, enforced via `aal2` check in middleware
- KSA PDPL: consent banner before non-essential cookies; visitor-hash cookie argued as essential (security/abuse)

---

## Phased Delivery (5 phases, each ends in a reviewable deploy)

**Phase 1 — Foundations (week 1)**
Init repo, push to GitHub. Next 15 + TS strict + Tailwind v4 + shadcn (re-themed with `@theme`: `--radius: 0`, full Al Hewal palette, IBM Plex Sans/Arabic). next-intl with `/ar` default. Supabase project + migrations 0001/0002 + seed amenities. `lib/supabase/{server,client,admin}.ts` + `import 'server-only'`. Vercel Blob token. Vitest + RTL + Playwright skeletons. GitHub Actions CI: typecheck, lint, vitest+coverage, playwright smoke, build. Husky pre-commit (lint + secret scan). Vercel project linked. ENV scaffold in `.env.example`.
**Done when:** `pnpm build` green; `/ar` + `/en` render placeholder with correct `dir`; CI green; RLS smoke test passes (anon reads seeded property, cannot read draft).

**Phase 2 — Public site (weeks 2–3)**
Home (hero, value-prop grid, featured carousel, trust banner, footer). Catalog (filters via searchParams server-rendered, debounced client search, pagination). Property Detail (masonry + Radix Dialog lightbox, bilingual brief, amenities, sticky contact card, lazy Google Maps Embed, fixed mobile WhatsApp/Call bar). API routes `/whatsapp/track` and `/track/view`. sitemap + robots + JSON-LD `RealEstateListing` per property + hreflang alternates. ISR `revalidate=3600` home/catalog, `revalidate=86400` + on-demand `revalidateTag('property:'+id)` on detail. OG images per locale via `opengraph-image.tsx` (Edge runtime, IBM Plex Sans Arabic woff2 subset bundled).
**Done when:** Lighthouse mobile ≥ 90 on detail page; Playwright covers AR+EN happy paths; WhatsApp click writes lead row + 302s; axe-core zero serious violations on public routes.

**Phase 3 — Admin listings + leads (weeks 4–5)**
Password-auth login flow + `/auth/recovery` (Supabase implicit flow with client-side fragment handoff, see PR #37). Admin guard middleware (signed-cookie cache, 5-min TTL). Admin shell (sidebar + topbar). Listings table (server-paginated, server-filtered, row-hover actions). Single-page Add/Edit Property form (3-step wizard reduced to one page during build — PR #19). Drag-drop upload → server-side multipart → `sharp` pipeline (resize, AVIF/WebP, EXIF strip — PR #29). Leads Journal with filter bar, status updates, inline notes, and bilingual CSV export (PR #47). Image reorder + hero pick on the property edit page (PR 3.5c).
**Done when:** Property mutations trigger `revalidateTag` + audit log row; bilingual CSV export of leads works (Excel-on-Windows reads Arabic correctly via UTF-8 BOM); RLS prevents standard_admin from deleting properties they don't own (if that rule is enabled); coverage ≥ 80% on admin code; happy-path admin E2E (login → create → upload → publish → public visibility) green against a preview deploy.

> **Scope-cut (2026-05-20):** Bilingual PDF export of leads (originally
> via `@react-pdf/renderer` with IBM Plex Sans Arabic + RTL shaping)
> is **deferred indefinitely pending demand**. The CSV export shipped
> in PR #47 satisfies the bilingual export need (UTF-8 BOM + RFC 4180,
> opens correctly in Excel and Numbers in both Arabic and English).
> A PDF version was specced (`docs/specs/2026-05-20-pr-3.7-phase-3-wrap-design.md`
> contains the dropped-PDF analysis): at the row caps that would make
> the document useful, render time exceeds Vercel's free-tier 10s
> function window and output sizes exceed the 4.5 MB response cap. If
> a stakeholder asks for a branded PDF later, the data plumbing
> (`listAllLeadsForExport` + the audit shape) is already in place.

**Phase 4 — Admin users + analytics (week 6)**
Admin Management (promote/deactivate/last-login) shipped early as PR #33 (hardened by #39/#40). The remaining Phase 4 surface shipped as **PR 4-A (#50)** — Strategic Analytics + My Profile — closing the phase. The originally-planned PR 4-B (TOTP) was dropped, so Phase 4 ships as a single PR after all (lines up with the 1-PR-per-phase preference).

- **PR 4-A (#50, merged): Strategic Analytics + My Profile.** Dashboard at `/admin/analytics` with 4 KPI cards (leads 30d, WhatsApp clicks 30d, published properties, top property by leads) + Recharts line chart (leads/day, 30d) + Recharts bar charts (leads-by-source, top-10 cities by lead count). My Profile at `/admin/profile` with identity block + change-email + change-password forms via `supabase.auth.updateUser`.

**Done when:** super_admin can invite/promote/deactivate (PR #33 ✅); standard_admin sees no admin-management nav (PR #33 ✅); analytics dashboard renders the 4 KPI cards + 3 charts with locale-driven RTL/LTR + empty-state copy when zero data (PR #50 ✅); My Profile lets the admin update email + password through Supabase Auth (PR #50 ✅). Tag `v0.4.0 — Admin users + analytics` after PR #50 is verified against the preview deploy (runbook §11).

> **Scope amendments (2026-05-21, Phase 4 brainstorm + closeout):**
>
> - **TOTP enrolment for super_admin** — the originally-planned PR 4-B
>   — is **dropped indefinitely**. Email + password auth (PR #24 +
>   the implicit-flow fragment handler in PR #37) is acceptable
>   for the current single-tenant Saudi-owner deployment; introducing
>   a second factor at this stage would add enrolment + recovery-code
>   - lockout surface without a corresponding threat model that
>     justifies it. Revisit if/when the admin user count grows beyond
>     the owner or the team gains a security-sensitive customer base.
> - Originally specced "bespoke SVG KSA heatmap from `leads.region`
>   aggregation" → replaced with **top-10 cities bar chart from
>   `leads.city` aggregation**. Saves ~150 LOC + a 50 KB SVG asset
>   - admin-boundary maintenance burden. Cities is more actionable
>     for the sales team than regions.
> - Originally specced "analytics reads MVs only" → relaxed to
>   "analytics reads from raw `leads`/`whatsapp_clicks`/`properties`
>   tables, indexed COUNT queries only". The `page_views_daily`
>   rollup + `pg_cron` migrations (originally `0004_cron.sql`,
>   never shipped) are deferred until traffic volume justifies MV
>   infrastructure. Premature optimisation at Al Hewal's current
>   scale.

**Phase 5 — Polish / perf / a11y / security (week 7)**
axe-core in Playwright on every route; full RTL audit pass; CSP from report-only → enforce; Sentry wired with PII scrub in `beforeSend` (strip phone/email/name); favicon + manifest set; 404/500 polished; load test (k6) on catalog + WhatsApp track; free-tier dashboards documented in README; weekly pg_dump backup via GitHub Actions to private repo; database type generation pinned in CI (fail build on drift); KSA PDPL consent banner.
**Done when:** axe zero serious violations site-wide; CSP enforced; Sentry receives synthetic error; coverage ≥ 80%; load test passes at 100 RPS catalog / 20 RPS WhatsApp track; README documents quota dashboards.

---

## Critical Files to Create

| Path                                                            | Purpose                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `al-hewal/src/middleware.ts`                                    | next-intl chain + admin guard with cookie cache                        |
| `al-hewal/src/lib/supabase/admin.ts`                            | service-role client, `'server-only'`                                   |
| `al-hewal/src/lib/blob.ts`                                      | Vercel Blob + sharp pipeline (resize, AVIF/WebP, EXIF strip, blurhash) |
| `al-hewal/src/lib/csp.ts`                                       | per-request nonce generator                                            |
| `al-hewal/src/lib/ratelimit.ts`                                 | Upstash bindings                                                       |
| `al-hewal/src/lib/audit.ts`                                     | `withAudit()` HOF for admin mutations                                  |
| `al-hewal/src/lib/validators/property.ts`                       | Zod schemas (create/update/filter)                                     |
| `al-hewal/supabase/migrations/0001_init.sql`                    | enums + core tables + indexes                                          |
| `al-hewal/supabase/migrations/0002_rls.sql`                     | RLS policies, seed amenities                                           |
| `al-hewal/supabase/migrations/0003_views.sql`                   | analytics MVs                                                          |
| `al-hewal/supabase/migrations/0004_cron.sql`                    | pg_cron schedules                                                      |
| `al-hewal/src/app/[locale]/(public)/properties/[slug]/page.tsx` | property detail with JSON-LD                                           |
| `al-hewal/src/app/api/whatsapp/track/route.ts`                  | rate-limited, audited, 302 to wa.me                                    |
| `al-hewal/src/app/api/invite-admin/route.ts`                    | super_admin only, token hashing                                        |
| `al-hewal/src/app/api/upload/route.ts`                          | signed Blob URL + sharp pipeline                                       |
| `al-hewal/src/components/public/PropertyCard.tsx`               | matches Stitch mockup exactly                                          |
| `al-hewal/src/components/admin/PropertyWizard.tsx`              | 3-step form                                                            |
| `al-hewal/src/i18n/messages/{ar,en}.json`                       | translation tables                                                     |
| `al-hewal/src/styles/globals.css`                               | Tailwind v4 `@theme`, IBM Plex fonts, `:lang(ar)` line-height          |
| `al-hewal/.github/workflows/ci.yml`                             | typecheck, lint, vitest+coverage, playwright, build                    |
| `al-hewal/.github/workflows/backup.yml`                         | weekly pg_dump                                                         |
| `al-hewal/README.md`, `CLAUDE.md`, `SECURITY.md`                | docs                                                                   |

---

## Reusable Reference Assets

- **Design tokens:** `stitch_alhewal_bilingual_corporate_website/al_hewal_architectura/DESIGN.md` — translate directly into `@theme` block in `globals.css`
- **HTML mockups:** `stitch_alhewal_bilingual_corporate_website/{home_al_hewal_legacy,property_catalog,property_detail_al_dana_project,admin_*}/code.html` + `screen.png` — pixel reference for every component
- **React sketch:** `stitch_alhewal_bilingual_corporate_website/al_hewal_react_codebase.txt` — Stitch's 244-line draft; useful for copy/translation strings, not for architecture
- **Company copy + sample ad:** `stitch_alhewal_bilingual_corporate_website/alhewal.txt` (Arabic) — used for home hero + about copy

---

## Verification Plan

End-to-end verification per phase (must be runnable locally + in CI):

1. **Build & types:** `pnpm build` && `pnpm typecheck` — green, no `any` leaks
2. **Lint & format:** `pnpm lint` && `pnpm format:check`
3. **Unit + integration:** `pnpm test -- --coverage` — ≥ 80% statements/branches/functions/lines
4. **RLS test:** `pnpm test:rls` — anon key cannot read `admins`/`admin_invites`/`admin_audit_log`; cannot read draft/deleted properties
5. **E2E:** `pnpm test:e2e` — Playwright runs in CI (Chromium + WebKit + Firefox):
   - Public AR: home → catalog → filter → property detail → WhatsApp click → /api/whatsapp/track returns 302 and a new `leads` row exists
   - Public EN: same flow with `/en/...`
   - Locale switcher preserves path
   - Admin EN: magic-link login → list properties → create property via wizard → publish → appears in public catalog (after revalidate)
   - Admin AR: same flow under `/ar/admin/...` — verify wizard step labels, KPI cards, table headers, chart axis labels, and audit-log diff strings all render in Arabic with correct `dir="rtl"`
   - Locale switcher inside `/admin` round-trips path and preserves the page state
   - Admin: invite new admin → invite email body is in the inviter's `language_pref` → token email parsed → invite acceptance creates `admins` row with `status='active'`
   - Admin: super_admin promotes/deactivates standard_admin → audit log entries present with bilingual action labels
   - PDF export tested in both AR and EN; Arabic PDF passes shaping verification (no broken ligatures, no reversed digits)
6. **a11y:** `pnpm test:a11y` — Playwright + axe-core on every route, zero serious violations
7. **Performance:** `pnpm lighthouse:ci` — mobile score ≥ 90 on home/catalog/detail
8. **Security:** `pnpm audit --audit-level=high` + manual CSP verification via `curl -I` checking headers
9. **Free-tier sanity:** README section "Quota Dashboards" with screenshots of Vercel/Supabase/Blob usage; nightly GitHub Action that fails if Blob > 4GB or DB > 400MB
10. **Backup verification:** `gh workflow run backup.yml` produces a dump artifact; restore-drill documented in `SECURITY.md`

**Manual KSA-reviewer-friendly verification (live preview URL):**

- Open `/ar` on mobile, verify Arabic hero renders right-aligned, sticky WhatsApp bar visible, tap WhatsApp button → wa.me opens with prefilled bilingual message containing property URL
- Open `/en` on desktop, verify locale switcher round-trips path
- Open `/ar/admin` while logged out → redirected to `/ar/auth/login`
- Test invite link flow end-to-end (super_admin invites a test email, accept link sets password, new admin logs in, sees only allowed nav)
- View Strategic Analytics — KPI cards populated within 15 min of seeded data via MV refresh

---

## Out of Scope (explicitly)

- Public user accounts / saved-properties — not requested
- Multi-tenant / multi-developer — single tenant (Al Hewal)
- In-house chat (only WhatsApp deep-link)
- Mobile native app — responsive web only
- Payment processing — leads only, sales happen offline via WhatsApp
- Service worker / full PWA — manifest only

---

## Open Risks to Surface Early

1. **Arabic PDF rendering** — `@react-pdf/renderer` RTL shaping is historically fragile. Plan a 1-day spike in Phase 3 with a tiny Arabic-only PDF to de-risk; if blocked, fall back to Puppeteer-on-Vercel-Edge (slower, more invocations).
2. **Arabic full-text search** — `to_tsvector('simple', ...)` doesn't stem Arabic. Plan to install `unaccent` and add a `gin_trgm_ops` index on `title_ar` as the search fallback if reviewer flags poor Arabic relevance.
3. **Google Maps API key exposure** — Embed API uses a URL-embedded key. Restrict by HTTP referrer to `*.vercel.app` and the production domain in the Google Cloud Console; rotate at launch.
4. **Vercel cold starts on admin routes** — `force-dynamic` admin pages will cold-start. Mitigate with Vercel "warm" cron pinging `/admin` every 5 min if admins complain (counts against function invocations — measure first).
