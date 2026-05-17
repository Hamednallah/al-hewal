# Al Hewal — Real Estate Platform

> الحوال — نبني الجودة… ونصنع المستقبل
>
> Al Hewal: We build quality... and shape the future.

A production-grade bilingual (Arabic / English) corporate website and admin
Command Center for **Al Hewal Real Estate Development and Investment Company**,
a Saudi developer of premium residential and investment properties.

The platform showcases active projects, captures qualified leads through
WhatsApp conversion tracking, and gives administrators a full back-office for
inventory, leads, analytics, and team management.

---

## Project Status

Phase 1 (Foundations) shipped as `v0.1.1`. Phase 2 (Public site) is
in progress — 4 of 8 sub-PRs merged.

**Resuming work in a new session?** Read
[`docs/SESSION_HANDOFF.md`](docs/SESSION_HANDOFF.md) **first**. It's
the entire context needed to pick up without re-reading chat history.

The approved master plan is committed at
[`docs/plan/MASTER_PLAN.md`](docs/plan/MASTER_PLAN.md). The agent's
project memories — working agreements, locked decisions, project
context — are mirrored at
[`docs/agent-memory/`](docs/agent-memory/) for any new contributor
or session.

## Tech Stack

| Layer         | Choice                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| Framework     | Next.js 15 App Router (React 19, TypeScript strict)                      |
| Styling       | Tailwind v4 + shadcn/ui (Radix), re-themed to the Al Hewal design system |
| i18n          | next-intl, `/ar` (default) and `/en` path prefixes, full RTL/LTR support |
| Database      | Supabase Postgres with Row Level Security                                |
| Auth          | Supabase Auth — magic-link admin invites only, no public signup          |
| Image storage | Vercel Blob (raw) + `next/image` (AVIF / WebP transforms)                |
| Maps          | Google Maps Embed API (lazy-loaded)                                      |
| Charts        | Recharts                                                                 |
| Forms         | React Hook Form + Zod                                                    |
| Testing       | Vitest + React Testing Library + Playwright (E2E + axe-core)             |
| Observability | Sentry, Vercel Logs, first-party `page_views` table                      |
| Hosting       | Vercel                                                                   |

## Local Development

> Prerequisites: Node.js 22+, Corepack enabled, Git, optionally Docker for
> local Supabase.

```powershell
# 1. Activate the pinned pnpm version (Corepack reads packageManager from package.json)
corepack enable
corepack prepare --activate

# 2. Install dependencies with the frozen lockfile (no silent upgrades)
pnpm install --frozen-lockfile

# 3. Copy and fill the environment variables
Copy-Item .env.example .env.local
# edit .env.local

# 4. Start the dev server
pnpm dev
```

The site will be available at:

- Arabic (default): http://localhost:3000/ar
- English: http://localhost:3000/en
- Admin: http://localhost:3000/ar/admin (requires authentication)

## Scripts

| Script                              | Purpose                                         |
| ----------------------------------- | ----------------------------------------------- |
| `pnpm dev`                          | Start the Next.js dev server with hot reload    |
| `pnpm build`                        | Production build                                |
| `pnpm start`                        | Run the production build locally                |
| `pnpm typecheck`                    | TypeScript strict typecheck                     |
| `pnpm lint`                         | ESLint                                          |
| `pnpm format` / `pnpm format:check` | Prettier write / check                          |
| `pnpm test`                         | Unit + integration tests (Vitest) with coverage |
| `pnpm test:e2e`                     | Playwright end-to-end suite                     |
| `pnpm test:a11y`                    | Playwright + axe-core accessibility audit       |
| `pnpm test:rls`                     | Supabase Row Level Security regression test     |
| `pnpm audit:signatures`             | Verify npm provenance attestations              |
| `pnpm audit:deps`                   | High/critical CVE gate                          |

## Repository Layout

```
al-hewal/
├── supabase/migrations/     SQL migrations (numbered, append-only)
├── src/
│   ├── app/[locale]/        Bilingual public + admin routes
│   ├── app/api/             Server endpoints (lead capture, uploads, invites)
│   ├── components/          public/, admin/, ui/ (shadcn)
│   ├── i18n/messages/       ar.json, en.json
│   ├── lib/                 supabase/, blob, validators, audit, csp, ratelimit
│   ├── middleware.ts        next-intl + admin guard
│   └── styles/globals.css   Tailwind v4 @theme tokens
├── tests/{unit,integration,e2e}/
├── public/                  static assets (icons, fonts)
└── .github/workflows/       CI, backup, deploy-supabase
```

## Security

This project follows a strict supply-chain hardening policy: postinstall
scripts are disabled by default, package versions are pinned exactly,
freshly-published versions are quarantined for 7 days, and all secrets are
managed through Vercel and Supabase environment scopes — never committed.

See [`SECURITY.md`](SECURITY.md) for the full policy, incident response
procedure, and the secret rotation schedule.

## Accessibility & Internationalisation

The platform meets WCAG 2.1 AA. Arabic content uses IBM Plex Sans Arabic with
RTL-aware logical CSS properties, mirrored iconography, and bilingual
`alt` text. Every public page emits `hreflang` alternates for `ar-SA`,
`en`, and `x-default`.

## License

Proprietary. See [`LICENSE`](LICENSE).

All rights reserved by Al Hewal Real Estate Development and Investment
Company. Not for redistribution.
