# Phase 1 Dependency Audit

> Generated 2026-05-17 before initial `pnpm install`. Every package below was
> verified against the supply-chain hardening policy in `SECURITY.md`:
>
> - Version is pinned exactly (no `^` / `~`)
> - Version is **at least 7 days old** (quarantine window)
> - Maintainer is well-established (Next.js team, React team, Vercel, Supabase,
>   Testing Library, Microsoft, OpenJS Foundation, etc.)
> - No known security incidents in the last 12 months
> - No install scripts (or scripts are explicitly allowlisted via
>   `pnpm.onlyBuiltDependencies`)
> - Weekly downloads > 10k (most are > 1M)
>
> Source-of-truth for verification: live query of
> `https://registry.npmjs.org/` on 2026-05-17.

## Runtime dependencies

| Package                 | Version | Published             | Maintainer        | Purpose                                                           |
| ----------------------- | ------- | --------------------- | ----------------- | ----------------------------------------------------------------- |
| `next`                  | 15.5.18 | 2026-05-07 (10 d ago) | Vercel            | Next.js 15 App Router framework                                   |
| `react`                 | 19.2.6  | 2026-05-08 (9 d ago)  | Meta (React team) | UI library                                                        |
| `react-dom`             | 19.2.6  | 2026-05-08 (9 d ago)  | Meta (React team) | DOM renderer                                                      |
| `next-intl`             | 4.11.1  | 2026-05-08 (9 d ago)  | Jan Amann         | Bilingual `/ar`+`/en` routing, RTL, message catalog               |
| `@supabase/ssr`         | 0.10.3  | 2026-05-07 (10 d ago) | Supabase          | Server-side cookie-based auth helpers for Next.js                 |
| `@supabase/supabase-js` | 2.105.4 | 2026-05-08 (9 d ago)  | Supabase          | Postgres / Auth / Realtime client                                 |
| `zod`                   | 4.4.3   | 2026-05-04 (13 d ago) | Colin McDonnell   | Runtime input validation at API + form boundaries                 |
| `server-only`           | 0.0.1   | 2022                  | Vercel            | Compile-time guard to keep service-role key out of client bundles |

## Development dependencies

| Package                       | Version | Published             | Maintainer        | Purpose                                                                                                                                                                                      |
| ----------------------------- | ------- | --------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`                  | 5.9.3   | 2025-10-01            | Microsoft         | Type checker. **Pinned to 5.x intentionally** — TS 6.0.3 is current latest but ecosystem (ESLint plugins, next-lint, ts-eslint) lags major TS releases by 4-8 weeks. Re-evaluate in Phase 5. |
| `@types/node`                 | 24.12.3 | 2026-05-08 (9 d ago)  | DefinitelyTyped   | Matches Node 24 runtime on Vercel                                                                                                                                                            |
| `@types/react`                | 19.2.14 | 2026-02-11            | DefinitelyTyped   | React 19 types                                                                                                                                                                               |
| `@types/react-dom`            | 19.2.3  | 2025-11-12            | DefinitelyTyped   | React-DOM 19 types                                                                                                                                                                           |
| `tailwindcss`                 | 4.3.0   | 2026-05-08 (9 d ago)  | Tailwind Labs     | CSS framework (v4 with native `@theme`)                                                                                                                                                      |
| `@tailwindcss/postcss`        | 4.3.0   | 2026-05-08 (9 d ago)  | Tailwind Labs     | PostCSS plugin for Tailwind v4                                                                                                                                                               |
| `postcss`                     | 8.5.14  | 2026-05-04 (13 d ago) | OpenJS Foundation | CSS processor (required by Tailwind v4)                                                                                                                                                      |
| `eslint`                      | 9.39.4  | 2026-03-07 (71 d ago) | OpenJS Foundation | Linter. **Pinned to 9.x** — `eslint-config-next@15.5.18` peer-deps `^7\|^8\|^9` and does not support ESLint 10 yet. Re-evaluate when we bump to Next 16.                                     |
| `eslint-config-next`          | 15.5.18 | 2026-05-07 (10 d ago) | Vercel            | Next.js + React + a11y lint rules; version matches Next 15.5.18                                                                                                                              |
| `@eslint/eslintrc`            | 3.3.5   | 2026-03-07 (71 d ago) | OpenJS Foundation | Flat-config compatibility shim; loads eslint-config-next's legacy preset into our flat config                                                                                                |
| `prettier`                    | 3.8.3   | 2026-04-15 (32 d ago) | Prettier team     | Formatter                                                                                                                                                                                    |
| `prettier-plugin-tailwindcss` | 0.8.0   | 2026-04-27 (20 d ago) | Tailwind Labs     | Class-order formatting                                                                                                                                                                       |
| `husky`                       | 9.1.7   | 2024-11-18            | Typicode          | Git hook installer (battle-tested, no incidents)                                                                                                                                             |
| `lint-staged`                 | 17.0.4  | 2026-05-09 (8 d ago)  | lint-staged team  | Run linters on staged files                                                                                                                                                                  |
| `vitest`                      | 4.1.5   | 2026-04-21 (26 d ago) | Vitest team       | Unit + integration test runner                                                                                                                                                               |
| `@vitest/coverage-v8`         | 4.1.5   | 2026-04-21 (26 d ago) | Vitest team       | Coverage via V8 profiler                                                                                                                                                                     |
| `@vitejs/plugin-react`        | 6.0.1   | 2026-03-13 (65 d ago) | Vite team         | React Fast Refresh in Vitest                                                                                                                                                                 |
| `happy-dom`                   | 20.9.0  | 2026-04-14 (33 d ago) | Capricorn         | Lightweight DOM for Vitest (faster than jsdom)                                                                                                                                               |
| `@testing-library/react`      | 16.3.2  | 2026-01-19            | Testing Library   | RTL queries for React 19                                                                                                                                                                     |
| `@testing-library/jest-dom`   | 6.9.1   | 2025-10-01            | Testing Library   | DOM matchers                                                                                                                                                                                 |
| `@testing-library/user-event` | 14.6.1  | 2025-01-21            | Testing Library   | Realistic user-event simulation                                                                                                                                                              |
| `@playwright/test`            | 1.59.1  | 2026-04-01 (46 d ago) | Microsoft         | E2E test runner                                                                                                                                                                              |
| `@axe-core/playwright`        | 4.11.3  | 2026-04-30 (17 d ago) | Deque Systems     | a11y assertions inside Playwright tests                                                                                                                                                      |

## Build-script allowlist

Postinstall scripts are **disabled by default** (`.npmrc` → `ignore-scripts=true`).
The source of truth for which packages may run scripts is
[`pnpm-workspace.yaml`](../pnpm-workspace.yaml) under `allowBuilds`. Only the
packages below are permitted:

| Package              | Why it needs a build step                                                   | Pulled in by                                               |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `@parcel/watcher`    | Native file-watching for HMR; falls back to slow polling without it         | `next-intl`                                                |
| `@swc/core`          | Native compiler binary; falls back to wasm-SWC without it (slower builds)   | `next-intl`                                                |
| `@tailwindcss/oxide` | Native Rust binary for Tailwind v4's CSS engine                             | `tailwindcss`                                              |
| `esbuild`            | Platform-specific native binary                                             | transitively by Next, Vitest, ESLint                       |
| `sharp`              | libvips-backed image transforms; **required** for `next/image` optimization | `next`                                                     |
| `unrs-resolver`      | Rust-based TypeScript module resolver for ESLint                            | `eslint-config-next` → `eslint-import-resolver-typescript` |

All six are pulled transitively by our direct dependencies (Next, next-intl,
Tailwind, eslint-config-next) — they are not packages we chose independently.
All six are from established maintainers (Vercel/Next, Tailwind Labs, the
SWC team at Vercel, lovell/sharp, Parcel team) with download counts in the
millions per week and no known security incidents in the last 12 months.

No third-party / obscure native addon is on this list.

## Package manager

`packageManager: "pnpm@11.0.9"` — Corepack reads this field and activates the
exact version. pnpm 11.0.9 was published 2026-05-09 (8 days ago).
`min-release-age=10080` (= 7 days in minutes) requires pnpm 10.10+, satisfied
here.

## Phase 2 additions (audited 2026-05-17, shipped through v0.2.0)

The Phase 2 PRs (#1–#10) introduced these direct runtime dependencies
on top of the Phase 1 baseline. Same supply-chain criteria as above
(pinned exact, ≥ 7-day quarantine, established maintainer, no recent
CVE, no install scripts unless allowlisted).

| Package                    | Version | Maintainer           | Purpose                                                                                            | Landed in    |
| -------------------------- | ------- | -------------------- | -------------------------------------------------------------------------------------------------- | ------------ |
| `@radix-ui/react-dialog`   | 1.1.15  | WorkOS / Radix       | Accessible modal for MobileDrawer + property-detail Gallery lightbox                               | PR 2.2 / 2.4 |
| `@radix-ui/react-slot`     | 1.2.4   | WorkOS / Radix       | `Button asChild` so `<Link>` inherits button styles without losing semantics                       | PR 2.1       |
| `class-variance-authority` | 0.7.1   | Joe Bell             | Variant API for the Button component                                                               | PR 2.1       |
| `clsx`                     | 2.1.1   | lukeed               | Conditional className composition (used by `cn()`)                                                 | PR 2.1       |
| `tailwind-merge`           | 3.5.0   | dcastil              | Resolves duplicate Tailwind classes inside `cn()`                                                  | PR 2.1       |
| `material-symbols`         | 0.44.6  | Marella              | Icon CSS package — installed for future admin use; Phase 2 components use inline SVG instead       | PR 2.1       |
| `maplibre-gl`              | 5.24.0  | MapLibre org         | Property-detail map (lazy-loaded via IntersectionObserver in PR 2.4)                               | PR 2.1       |
| `blurhash`                 | 2.0.5   | woltapp              | Placeholder hash for property images (computed by the Phase 3 upload pipeline)                     | PR 2.1       |
| `libphonenumber-js`        | 1.13.0  | Catamphetamine       | E.164 normalisation in `/api/leads` (region default: SA)                                           | PR 2.5       |
| `@upstash/ratelimit`       | 2.0.8   | Upstash              | Sliding-window rate limiters for `/api/whatsapp/track`, `/api/leads`, `/api/track/view`            | PR 2.5       |
| `@upstash/redis`           | 1.38.0  | Upstash              | REST client backing the rate limiters; transparent no-op when `UPSTASH_REDIS_REST_*` env is absent | PR 2.5       |
| `react-hook-form`          | 7.75.0  | Beier (Bluebill)     | Installed early; not yet used in Phase 2 (admin wizard in Phase 3)                                 | PR 2.1       |
| `@hookform/resolvers`      | 5.2.2   | react-hook-form team | Zod resolver for react-hook-form (Phase 3)                                                         | PR 2.1       |

Dev-deps added in Phase 2:

| Package          | Version | Maintainer   | Purpose                                                                                                                                                                                                                                                                                               | Landed in |
| ---------------- | ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `supabase` (CLI) | 2.98.2  | Supabase     | Local `pnpm supabase db reset` + remote migration push + typegen                                                                                                                                                                                                                                      | PR 2.1    |
| `sharp`          | 0.34.5  | lovell/sharp | Pulled forward from Phase 3.5 as a **devDep** only — used by `scripts/generate-favicons.mjs` to resize the brand logo into the favicon + PWA icon set. PR 3.5 will promote it to `dependencies` for the server-side image upload pipeline. Postinstall already allowlisted via `pnpm-workspace.yaml`. | PR 2.10   |
| `png-to-ico`     | 3.0.1   | steambap     | Packs the multi-size PNG buffers (16/32/48) into a single legacy `favicon.ico`. One-off use by `scripts/generate-favicons.mjs`; no postinstall script.                                                                                                                                                | PR 2.10   |

Postinstall scripts: none of the Phase 2 additions request build
scripts beyond the six already allowlisted in Phase 1. `sharp` is one
of those six; `png-to-ico` has none.

## Deferred to later phases

These will be added in their respective phases with the same audit treatment:

- **Phase 3:** `@vercel/blob`, `@react-pdf/renderer` (sharp pulled forward in PR 2.10)
- **Phase 4:** `recharts`
- **Phase 5:** `@sentry/nextjs`

## How to verify this audit yourself

```powershell
# Confirm published date
npm view next@15.5.18 time
npm view react@19.2.6 time
# ... etc

# Confirm npm provenance attestation (post-install)
pnpm audit signatures

# Confirm no high/critical CVEs
pnpm audit --audit-level=high

# (Recommended) Run Socket.dev scan on the lockfile after install
# npx @socketsecurity/cli scan
```
