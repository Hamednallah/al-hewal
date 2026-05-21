# PR 5-A — Phase 5 (first half): User-facing polish + a11y + compliance

> Design spec for the first PR of Phase 5. Phase 5 splits into 2 PRs
> per the user's choice during the 2026-05-21 scope question.
>
> - **PR 5-A (this PR):** User-facing polish + a11y sweep + KSA PDPL
>   consent banner + 500 page + dead-code removal.
> - **PR 5-B (next PR):** Infrastructure — CSP enforce, Sentry, DB
>   type generation pin in CI, pg_dump backup workflow, README
>   free-tier dashboards docs, k6 load test.
>
> The split line is user-visible vs invisible. PR-A is "what the
> visitor sees"; PR-B is "what the operator sees / CI sees".

## Context

Phase 5 is the polish / perf / a11y / security wrap of the master
plan. With Phase 4 closed (PR #50 + #51), the remaining surface
across both Phase 5 PRs is:

- axe-core sweep on every public route (admin already covered in PR #45)
- Full RTL audit pass — verifying logical properties throughout
- CSP report-only → enforce
- Sentry + PII scrub
- `global-error.tsx` + `error.tsx` (500 page polish)
- Load test (k6) on catalog + WhatsApp track
- README free-tier dashboards documented
- Weekly pg_dump backup workflow
- Database type generation pinned in CI (fail build on drift)
- KSA PDPL consent banner

PR 5-A owns the items the visitor actually sees + the simplest
quick wins (AdminPlaceholder dead code).

## Goals

1. **KSA PDPL consent banner.** A bilingual sticky-bottom banner
   explaining what cookies / tracking the site uses, with an
   "Accept" action that sets a cookie so the banner does not
   re-appear. Covers the WhatsApp click tracking, the
   `_alh_v` visitor cookie, and the contact-form lead capture.
2. **500 page polish.** Add `app/global-error.tsx` (root-layout
   errors) and `app/[locale]/error.tsx` (locale-segment errors).
   Bilingual chrome mirroring `not-found.tsx`'s pattern (404
   page already shipped in PR 2.9).
3. **RTL audit sign-off.** A spot-check pass on public surfaces
   in `dir="rtl"` to catch any remaining `ml-*` / `mr-*` /
   `text-left` / `text-right` regressions. Initial grep shows
   zero violations across `src/**/*.tsx`, so this is a
   verification step, not a refactor.
4. **axe-core public sweep.** The existing
   `tests/e2e/public.a11y.spec.ts` covers home, catalog,
   catalog-empty-filter, about, contact. Property detail is
   missing — add it.
5. **Dead-code cleanup.** Delete `AdminPlaceholder.tsx`, which
   has no consumers post-PR #50.

## Non-goals (deferred to PR 5-B)

- CSP `report-only` → enforce.
- Sentry + PII-scrub `beforeSend`.
- DB type generation pinned in CI.
- Weekly pg_dump backup workflow.
- README free-tier dashboards documentation.
- k6 load test on catalog + WhatsApp track.

## Architecture

### 1. PDPL consent banner

**File:** `src/components/public/ConsentBanner.tsx` (client
component) + `src/app/[locale]/(public)/layout.tsx` (mount point)

- `src/app/api/consent/route.ts` (server action endpoint).

**Cookie:** `alh_consent` — HTTP-only, 1-year, lax SameSite,
`v=1` value. Set by `POST /api/consent`. If present, the banner
unmounts (server-side conditional render).

**UX:**

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  We use cookies for essential site functionality and to track    │
│  WhatsApp lead clicks and contact form submissions. You can      │
│  read more in our privacy notice.                                │
│                                                                  │
│                              [ Accept ]  [ Privacy notice → ]    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Bilingual copy. RTL flips the button order naturally because the
button row is `flex` with logical `gap-*` only. Accept button hits
`/api/consent` and reloads the route (server component re-renders
without the banner).

**Why this is PDPL-compliant for the Al Hewal use case:**

- The data we collect (IP hash for rate limiting, visitor hash
  for view dedupe, lead row from explicit WhatsApp/Form click) is
  all "essential" to the user's voluntary action.
- The banner is **informative**, not gating. We don't block
  WhatsApp clicks before consent because the click IS the consent.
- Future work (PR 5-B): "Privacy notice →" link should point at
  a real `/<locale>/privacy` page. That page is out of scope for
  PR 5-A; the link is rendered but goes to a stub `/privacy`
  route which lives in PR 5-B (or a later docs PR).

### 2. 500 page polish

**Files:**

- `src/app/global-error.tsx` — catches errors in the root
  layout, including those that occur before next-intl mounts.
  Must include its own `<html>` + `<body>` because the root
  layout did not render.
- `src/app/[locale]/error.tsx` — catches errors below the
  locale segment. Inherits `<html>` + `<body>` from the
  locale layout, so it's just the content.

Both pages bilingual. The locale-segment `error.tsx` reads
the locale from the URL via `useParams` and renders the
correct AR/EN copy. The `global-error.tsx` shows BOTH
languages side-by-side (same approach as `not-found.tsx`)
since the locale context may have failed.

**No Sentry capture in this PR** — PR 5-B adds the Sentry SDK

- the `beforeSend` PII scrub, and at that point both error
  boundaries get the `Sentry.captureException(error)` call.

### 3. RTL audit

Initial grep across `src/**/*.tsx`:

```
$ rg -e '(?:className=|class=)[^\n]*?\b(ml-\d|mr-\d|pl-\d|pr-\d|text-left|text-right|left-\d|right-\d|left-0|right-0)\b'
(no matches)
```

So the audit is "verify the assertion holds": run the public site
in `dir="rtl"` (Arabic locale), spot-check the Home, Catalog,
Property Detail, About, Contact, and 404 pages. No regression
expected; if anything surfaces, fix in this PR.

Spec recording the audit: add an `dir="rtl"` Playwright assertion
that the `<html dir>` attribute is `rtl` on `/ar/*` routes (most
spec files already do this implicitly).

### 4. axe-core public sweep

Extend `tests/e2e/public.a11y.spec.ts` with:

```ts
{ name: 'property-detail', path: '/properties/SLUG', skipIfEmpty: true },
```

Conditionally skip when the catalog is empty (CI's case — no
seeded properties). When data exists (e.g. against a preview
deploy with seeded rows), the spec scans the detail page.

### 5. AdminPlaceholder removal

`src/components/admin/AdminPlaceholder.tsx` has no consumers
post-PR #50. Delete it. Per CLAUDE.md "delete unused code".

## Components

| Type | Path                                        | Lines                           |
| ---- | ------------------------------------------- | ------------------------------- |
| new  | `src/components/public/ConsentBanner.tsx`   | ~90                             |
| new  | `src/app/api/consent/route.ts`              | ~40                             |
| edit | `src/app/[locale]/(public)/layout.tsx`      | +5                              |
| new  | `src/app/global-error.tsx`                  | ~80                             |
| new  | `src/app/[locale]/error.tsx`                | ~50                             |
| edit | `src/i18n/messages/{ar,en}.json`            | +20 each (consent + error keys) |
| edit | `tests/e2e/public.a11y.spec.ts`             | +5                              |
| new  | `tests/e2e/consent-banner.spec.ts`          | ~60                             |
| new  | `tests/unit/api/consent.test.ts`            | ~40                             |
| del  | `src/components/admin/AdminPlaceholder.tsx` | -64                             |

**~430 LOC + 1 deletion.**

## Tests

| Type | What                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unit | `consent.test.ts` — POST /api/consent sets the cookie, returns 200; same-origin guard refuses cross-origin POSTs                 |
| E2E  | `consent-banner.spec.ts` — banner renders on first visit (no cookie), disappears after Accept, doesn't re-appear on second visit |
| E2E  | `public.a11y.spec.ts` (extended) — property-detail axe scan conditional on data presence                                         |

Vitest stays at 80%+ branch coverage. The new code is small
enough that ~6 unit tests + 2 E2E specs comfortably cover it.

## Error handling

| Failure                          | Behavior                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/consent` cross-origin | 403 + `{ error: 'cross_origin' }` (matches existing pattern from `/api/leads`)                                              |
| `POST /api/consent` malformed    | 400                                                                                                                         |
| `global-error.tsx` triggers      | Render bilingual "Something went wrong" with a single "Reload" button (Next 15 error boundary contract: `reset()` callback) |
| `error.tsx` triggers             | Same shape, but locale-aware copy                                                                                           |
| RTL regression detected mid-PR   | Fix in this PR; otherwise note the violation in the design doc as a follow-up                                               |

## Free-tier impact

- One new endpoint (`/api/consent`) — invoked at most once per
  visitor (after Accept). Free-tier function invocations
  unaffected.
- One new cookie (`alh_consent`) — 1-year max-age, no
  additional bandwidth concern.
- No new tables, no migrations.
- No new client-side deps. ConsentBanner is a plain client
  component using existing `<Button>`.

## Rollout

1. Open PR titled `feat(phase-5/a): consent banner + 500 page + a11y sweep`.
2. CI: typecheck, lint, vitest, Playwright (incl. axe), build.
3. Merge once green.
4. The banner activates immediately on the next deploy. Visitors
   who already have `_alh_v` set still see the banner once
   (different cookie, different concern).
5. PR 5-B opens next (infrastructure half of Phase 5).

## Open questions

None blocking. Two minor follow-ups handed to PR 5-B:

- `/<locale>/privacy` page — the banner links to a stub today;
  the real privacy notice can ship later.
- Sentry capture in the new error boundaries — handed to PR 5-B
  alongside the Sentry SDK install.
