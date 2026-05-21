# PR 5-B — Phase 5 (second half): Infrastructure + ops (trimmed)

> Design spec for the second PR of Phase 5. PR 5-A (#52, merged,
> `v0.5.0` tagged) covered the user-facing half.
>
> **Scope evolved during implementation.** The original spec listed
> six items (CSP, Sentry, DB type CI gate, pg_dump backup workflow,
> README dashboards, k6 load test). During build, multiple of those
> revealed themselves as premature for current scale (zero traffic,
> one operator) AND/OR hit pnpm 11's `ERR_PNPM_IGNORED_BUILDS` gate.
> The PR was retrimmed mid-flight to ship the genuinely valuable
> items now and defer the rest.
>
> **Actual contents:**
>
> - CSP report-only header (security floor; promote to enforce in
>   follow-up after observation).
> - **MapEmbed tile-source swap** from `demotiles.maplibre.org` to
>   Carto Basemaps positron — production hotfix for HTTP 429 + CORS
>   block reported on `al-hewal.vercel.app`.
> - **Amenities admin UI** — closes the gap left by PR 3.4 where
>   the public detail page rendered amenities but the admin had no
>   way to set them.
> - CI workflow trim — `pull_request` only, no more `push: main`
>   re-runs.
> - README free-tier dashboards section + `pnpm db:types` script.
>
> **Items dropped (with rationale):**
>
> - **Sentry SDK install + PII scrub:** zero traffic + one operator
>   - working error boundaries + Vercel built-in logs already cover
>     the use case. Bundle weight + setup complexity not justified
>     today. Plus `@sentry/cli`'s postinstall hits pnpm 11's
>     IGNORED_BUILDS gate. Revisit when traffic justifies it.
> - **DB type generation gate in CI:** would require Supabase CLI
>   in Docker on the runner (or solving the pnpm install gate for
>   `supabase` like we hit for `@sentry/cli`). Replaced with a
>   `pnpm db:types` script + a documented workflow. `tsc --noEmit`
>   catches drift implicitly when code references missing columns.
> - **Weekly pg_dump backup workflow:** Supabase's own daily project
>   backups cover disaster recovery at this scale.
> - **k6 load test script:** no production traffic to validate
>   against; the script would be aspirational.

## Context

Phase 5 of the master plan is the polish / perf / a11y / security
wrap. PR 5-A shipped the user-visible items (PDPL banner, 500 page,
a11y sweep, RTL audit confirmation, dashboard rebuild, plus the
mobile/UI bug fixes from production reports). The remaining items
are infrastructure-flavoured and ship together as PR 5-B.

## Goals

1. **CSP enforce** — Content-Security-Policy header generated at
   the middleware level with a per-request nonce on scripts. In
   production: `Content-Security-Policy` (enforce); in dev:
   `Content-Security-Policy-Report-Only` so iteration isn't broken.
2. **Sentry + PII scrub** — `@sentry/nextjs` SDK installed,
   configured for client / server / edge runtimes. `beforeSend`
   hook strips phone / email / name patterns before dispatch.
   Both new error boundaries from PR 5-A capture via Sentry.
3. **DB type generation guard in CI** — fail the build when the
   committed `database.types.ts` drifts from what the local
   migration tree would generate. Catches "forgot to regenerate
   types after migration" regressions before they reach prod.
4. **Weekly pg_dump backup workflow** — `.github/workflows/backup.yml`
   runs Sunday 04:00 UTC (~07:00 KSA), produces a full
   `pg_dump` of the linked Supabase project, uploads as a GH
   Actions artifact with 90-day retention.
5. **README free-tier dashboards** — operator-facing section
   listing every free-tier service the project depends on, with
   the quota dashboard URL and the metric to watch.
6. **k6 load test** — capacity sanity check script for the two
   high-cost endpoints (catalog page + WhatsApp track redirect).
   Run on demand, not in CI.

## Non-goals

- Setting up a separate backup repository. The GH Actions
  artifact store is sufficient for a free-tier project. If
  retention beyond 90 days is needed, follow-up PR can add an
  S3/B2/private-repo sync.
- Wiring Sentry release tracking + sourcemap upload. That
  requires `SENTRY_AUTH_TOKEN` + a build-time integration —
  worth doing later when the team has more eyes on errors.
- Migrating CSP from report-only to enforce in dev. Dev keeps
  report-only so Tailwind dev HMR / Next dev overlays don't
  break iteration.

## Components

### 1. CSP

**Files:**

- `src/lib/csp.ts` — pure functions: `generateNonce()` (Web Crypto
  `crypto.randomUUID()` base64-encoded), `buildCsp(nonce, isDev)`
  returning the header string.
- `src/middleware.ts` — extends the existing next-intl chain.
  Generates a nonce per request, sets it in a request header so
  RSCs can read it, sets the matching CSP response header.

**Directives:**

```
default-src 'self';
script-src 'self' 'nonce-{nonce}' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://demotiles.maplibre.org https://*.tile.openstreetmap.org;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://demotiles.maplibre.org https://*.sentry.io;
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

Rationale per directive:

- `style-src 'unsafe-inline'` — Tailwind v4's `<style>` injection +
  Recharts inline styles. Removing inline styles is a separate
  much-larger refactor.
- `img-src https://*.public.blob.vercel-storage.com` — property
  images served by Vercel Blob.
- `img-src https://demotiles.maplibre.org https://*.tile.openstreetmap.org` —
  the MapEmbed tile fetches.
- `connect-src https://*.supabase.co wss://*.supabase.co` —
  Supabase HTTP + realtime websocket.
- `connect-src https://*.sentry.io` — Sentry telemetry endpoint.
- `frame-src 'none'` — we don't embed third-party iframes (the
  Google Maps embed link opens in a new tab, doesn't iframe).

### 2. Sentry

**Files:**

- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `src/lib/sentry-scrub.ts` — pure `beforeSend(event)` that scrubs
  phone (E.164 + KSA digits), email, name patterns from
  `event.message`, `event.exception.values[].value`,
  `event.breadcrumbs[].message`, `event.request.headers`, and
  `event.user`.
- `next.config.ts` — wrap with `withSentryConfig`.
- `src/app/global-error.tsx` + `src/app/[locale]/error.tsx` — add
  `Sentry.captureException(error)` in `useEffect`.

**Env vars (additions to `.env.example`):**

- `NEXT_PUBLIC_SENTRY_DSN` — optional. When unset, Sentry SDK
  no-ops; nothing crashes.

### 3. DB type generation guard

**File:** `.github/workflows/ci.yml` — new step **before** typecheck:

```yaml
- name: Verify database.types.ts is up to date
  run: |
    pnpm supabase gen types typescript --local > /tmp/types.ts
    if ! diff -q /tmp/types.ts src/lib/supabase/database.types.ts; then
      echo "::error::database.types.ts is out of date — run pnpm db:types and commit"
      diff -u src/lib/supabase/database.types.ts /tmp/types.ts | head -50
      exit 1
    fi
```

This requires running `supabase start` first to spin up the local
DB from migrations. Adds ~30s to CI. Worth it.

**`package.json`** — new script `db:types` that operators run
locally after editing migrations.

### 4. pg_dump backup workflow

**File:** `.github/workflows/backup.yml`

```yaml
name: Weekly Supabase backup
on:
  schedule: [{ cron: '0 4 * * 0' }] # Sun 04:00 UTC ≈ 07:00 KSA
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Supabase CLI
        uses: supabase/setup-cli@v1
      - name: Dump
        env:
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase db dump --data-only --linked > data-$(date +%Y%m%d).sql
          supabase db dump --linked > schema-$(date +%Y%m%d).sql
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: supabase-backup-${{ github.run_id }}
          path: '*.sql'
          retention-days: 90
```

**Owner-side setup:** add `SUPABASE_DB_PASSWORD` and
`SUPABASE_PROJECT_REF` to repository secrets. Runbook §12 will
walk through this.

### 5. README free-tier dashboards

New top-level section in `README.md` titled
"Free-tier dashboards (operator)" listing:

| Service     | Dashboard URL                                      | Quota                                            | What to watch                            |
| ----------- | -------------------------------------------------- | ------------------------------------------------ | ---------------------------------------- |
| Vercel      | `vercel.com/<org>/al-hewal`                        | 100k function invocations/mo, 100GB bandwidth/mo | Function invocation count, bandwidth     |
| Supabase    | `supabase.com/dashboard/project/<ref>`             | 500MB DB, 2GB egress/mo, 50k MAU                 | DB size, egress, paused-project warnings |
| Vercel Blob | `vercel.com/<org>/~/stores/blob`                   | 1GB storage, 100GB bandwidth/mo                  | Storage + bandwidth                      |
| Sentry      | `sentry.io/organizations/<org>/projects/al-hewal/` | 5k errors/mo (free), 10k performance units       | Error count vs 5k                        |

### 6. k6 load test

**File:** `k6/catalog-and-whatsapp.js`

```js
import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    catalog: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      exec: 'catalog',
    },
    whatsapp: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      exec: 'whatsapp',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export function catalog() {
  const r = http.get(`${__ENV.BASE_URL}/ar/properties`);
  check(r, { 'status 200': (res) => res.status === 200 });
  sleep(1);
}

export function whatsapp() {
  const r = http.get(`${__ENV.BASE_URL}/api/whatsapp/track`, { redirects: 0 });
  check(r, { 'status 302': (res) => res.status === 302 });
}
```

Documented run command in README:
`k6 run -e BASE_URL=https://al-hewal.vercel.app k6/catalog-and-whatsapp.js`

Master-plan targets: catalog 100 RPS, WhatsApp track 20 RPS, both
sustained 2 minutes. p95 < 800ms, error rate < 1%.

## Tests

| Type | What                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit | `tests/unit/lib/csp.test.ts` — `generateNonce` returns base64 of correct length; `buildCsp` includes the right directives + the nonce                                          |
| Unit | `tests/unit/lib/sentry-scrub.test.ts` — PII scrub redacts phone (E.164, KSA digits), email, and name patterns                                                                  |
| E2E  | `tests/e2e/csp-headers.spec.ts` — every public route returns a `Content-Security-Policy` header containing `default-src 'self'`. Production header; dev would have report-only |

## Files touched (estimate)

| Type | Path                                  | Lines                                         |
| ---- | ------------------------------------- | --------------------------------------------- |
| edit | `.github/workflows/ci.yml`            | +15 (db:types step + drop push trigger)       |
| new  | `.github/workflows/backup.yml`        | ~40                                           |
| edit | `next.config.ts`                      | +10 (withSentryConfig)                        |
| edit | `package.json`                        | +deps + +1 script                             |
| edit | `src/middleware.ts`                   | +30 (CSP + nonce)                             |
| new  | `src/lib/csp.ts`                      | ~80                                           |
| new  | `src/lib/sentry-scrub.ts`             | ~70                                           |
| new  | `sentry.client.config.ts`             | ~25                                           |
| new  | `sentry.server.config.ts`             | ~25                                           |
| new  | `sentry.edge.config.ts`               | ~25                                           |
| edit | `src/app/global-error.tsx`            | +5                                            |
| edit | `src/app/[locale]/error.tsx`          | +5                                            |
| edit | `.env.example`                        | +1                                            |
| new  | `tests/unit/lib/csp.test.ts`          | ~70                                           |
| new  | `tests/unit/lib/sentry-scrub.test.ts` | ~80                                           |
| new  | `tests/e2e/csp-headers.spec.ts`       | ~40                                           |
| new  | `k6/catalog-and-whatsapp.js`          | ~50                                           |
| edit | `README.md`                           | ~50                                           |
| edit | `docs/PHASE_3_RUNBOOK.md`             | new §12 (Sentry DSN + Supabase secrets setup) |

**~700-900 LOC + ~3 dep additions.**

## Rollout

1. Open PR titled `feat(phase-5/b): CSP + Sentry + DB type gate + backup + ops docs`.
2. CI runs (pull_request only now); validates everything.
3. Owner-side: add `NEXT_PUBLIC_SENTRY_DSN`, `SUPABASE_DB_PASSWORD`,
   `SUPABASE_PROJECT_REF` to repo secrets (runbook §12).
4. Merge.
5. Owner re-tags `v0.5.0` to the new commit, or tags `v0.5.1`.

## Open questions

None blocking. The Sentry DSN provisioning is owner-side and
documented in the runbook addition.
