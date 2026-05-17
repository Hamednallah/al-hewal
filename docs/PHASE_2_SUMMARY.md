# Phase 2 Summary — Public Site (v0.2.0)

> Last updated: 2026-05-18, at PR 2.7 (tests + Phase 2 wrap).
> Sister doc to [`PHASE_1_SUMMARY.md`](PHASE_1_SUMMARY.md).

---

## TL;DR

Phase 2 ships the entire **public-facing** Al Hewal website: bilingual
home, catalog with URL-driven filtering, conversion-critical property
detail page, server-side conversion tracking (WhatsApp + leads + page
views), SEO surfaces (sitemap, robots, JSON-LD), and the end-to-end
Playwright + axe-core test gate.

Phase 1 (foundations) tagged at `v0.1.1`. Phase 2 closes at `v0.2.0`.

|                 |                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| PRs shipped     | 7 (#1 through #7 in this phase + #8 conversion + #9 SEO + this one)                                               |
| New routes      | 4 public pages + 3 API + sitemap + robots                                                                         |
| New components  | 7 public + 7 property-detail = 14                                                                                 |
| New lib modules | format, ip, pii, whatsapp, audit, ratelimit, cache, url-filters                                                   |
| Unit tests      | 86 (97%+ coverage on measured modules)                                                                            |
| E2E tests       | ~25 (functional + a11y across AR + EN)                                                                            |
| Bundle          | Home / catalog 125 kB; detail 147 kB first-load JS (all under the 300 kB app-page budget from web/performance.md) |

---

## What landed

### Phase 2.1 — Foundation (PR #1)

13 deps audited + installed, `cn()` util, sharp 0px `Button`
(4 variants × 3 sizes, `asChild` via Radix Slot), `supabase/seed.sql`
(4 KSA properties), `placehold.co` added to `next.config.ts` for the
seed hero images.

### Phase 2.2 — Chrome (PR #2)

`(public)` route group with shared layout: `SkipToContent` → `Nav` →
`<main id="main-content">` → `Footer`. `LangSwitcher` (client,
path-preserving, hrefLang). `MobileDrawer` (Radix Dialog, focus trap,
slides from inline-end).

### Phase 2.3 — Home (PR #3)

`Hero` (full-bleed teal + inline-SVG blueprint backdrop), `ValueGrid`
(3 numbered pillars), `FeaturedProjects` (data-driven, empty-state
fallback), `TrustBanner`. Reusable `PropertyCard`.
`src/lib/data/properties.ts` `getFeaturedProperties()`.
ISR `revalidate=3600` + `dynamic='force-static'`.

### Phase 2.4 — Catalog (PR #4)

`/<locale>/properties` with URL-driven filtering. Pure helpers in
`src/lib/url-filters.ts` (14 unit tests). `searchProperties()` +
`listFilterableCities()`. `FilterBar` (sticky, native HTML
`<form method="GET">`, zero client JS). Locale-aware `Pagination`
that preserves filters.

### Phase 2.5 — Detail (PR #7)

`/<locale>/properties/[slug]` — conversion-critical destination page.
Masonry CSS-Grid gallery + Radix Dialog lightbox (RTL-safe DOM order,
keyboard nav, focus restoration). `Brief` / `AmenitiesList` (grouped
by category) / `Specs` (inline SVG icons, no Material Symbols font
payload). Sticky desktop `ContactCard` + fixed mobile
`MobileContactBar`. Lazy MapLibre map (dynamic-imported,
IntersectionObserver-loaded). JSON-LD `RealEstateListing` schema.
`generateStaticParams` over every live slug × locale with ISR
revalidate=86400. Real 404 (`notFound()`) for unknown slugs.

### Phase 2.6 — Conversion API (PR #8)

- `GET /api/whatsapp/track[?p=<slug>&locale=ar|en]` — records the
  click (`leads` + `whatsapp_clicks`) and 302s to `wa.me` with a
  bilingual pre-filled message built server-side. Rate-limited
  10/min/IP.
- `POST /api/leads` — public contact-form endpoint. Zod-validated,
  Origin-guarded, phone normalised via `libphonenumber-js`. 5/min/IP,
  returns 429.
- `POST /api/track/view` — sendBeacon-friendly. Issues `_alh_v`
  cookie on first visit; daily-rotated `visitor_hash`.
- 6 lib modules: `ip`, `pii`, `whatsapp`, `audit`, `ratelimit`,
  `cache`.

### Phase 2.7 — SEO (PR #9)

- `/sitemap.xml` — multi-locale, hreflang alternates (ar-SA, en,
  x-default → AR), every live property slug. ISR 3600s.
- `/robots.txt` — allowlist `/`, disallow `/admin/`, `/api/`,
  `/auth/`, `/_next/`.
- JSON-LD `RealEstateAgent` on home; explicit `openGraph` + `twitter`
  metadata blocks.

### Phase 2.8 — Tests + wrap (this PR)

- ~25 Playwright tests across navigation, catalog, detail, WhatsApp,
  SEO, and the `*.a11y.spec.ts` axe-core scans for both locales.
- CI workflow runs `--project=chromium --project=a11y` together
  (single dev-server boot).
- `NEXT_PUBLIC_WHATSAPP_PHONE` in CI fixed from the `9665XXXXXXXX`
  placeholder (which failed env.ts regex at runtime) to `966500000000`.
- This summary doc.

---

## Deferred — landing later

|                                                               | Why                                                                                                                                                         | Where it'll land                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `/about`, `/contact` pages                                    | Footer links exist but pages are not on the Phase 2 scope. Lean Phase 2 ships the income funnel; static marketing pages add no funnel value.                | Fast-follow `2.9` or Phase 6 polish |
| Per-property dynamic OG-image generation (text-overlay cards) | The existing `openGraph.images` (property hero photo) already drives WhatsApp / Twitter previews. Text-overlay would need ~350 KB of TTF subsets committed. | Optional polish PR before go-live   |
| Google Search Console `verification.google`                   | Waits on the owner pasting their meta tag (POST_DEPLOY_CHECKLIST §1.1).                                                                                     | Pre-flight checklist                |
| Lighthouse CI (`@lhci/cli`)                                   | Local Lighthouse runs are how we audit today. Wiring `@lhci/cli` into CI is its own config surface and the manual run is sufficient for v0.2.0.             | Pre-flight checklist                |
| `revalidateTag` from admin mutations                          | Helpers shipped in `src/lib/cache.ts` (PR #8); admin mutations don't exist yet.                                                                             | Phase 3                             |
| Per-property live click → `leads` row Playwright assertion    | Requires a local Supabase running inside the CI runner (Docker pull + migrate + seed). Manual smoke item in the meantime.                                   | Optional CI hardening               |

---

## "Done when" — Phase 2 acceptance checklist

- [x] Home + catalog + detail render in both AR and EN
- [x] Filter-by-URL catalog with empty state
- [x] Property detail with masonry gallery + lightbox + sticky contact
- [x] WhatsApp + Call CTAs on every conversion surface
- [x] Server-side click tracking → `leads` + `whatsapp_clicks`
- [x] Contact-form endpoint with Zod + phone normalisation +
      rate-limit + Origin guard
- [x] Page-view tracker with daily-rotated visitor hash
- [x] Sitemap + robots
- [x] JSON-LD `RealEstateListing` on detail, `RealEstateAgent` on
      home
- [x] `generateMetadata` on every page (canonical, hreflang, OG, Twitter)
- [x] Playwright tests on AR + EN (navigation, catalog, detail-404,
      WhatsApp, SEO)
- [x] axe-core scans on every public route + 404, both locales
- [x] All gates green on `main` (`pnpm typecheck && pnpm lint &&
pnpm test && pnpm build`)

---

## Verification before tagging v0.2.0

Run, in order:

```powershell
# from al-hewal/
git checkout main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test --project=chromium --project=a11y
pnpm audit --audit-level=high
pnpm audit signatures   # informational
```

If everything is green:

```powershell
git tag -a v0.2.0 -m "v0.2.0 — Public site (Phase 2)"
git push origin v0.2.0
gh release create v0.2.0 --title "v0.2.0 — Public site" \
  --notes-file docs/PHASE_2_SUMMARY.md
```

---

## What's next — Phase 3 (admin Command Center)

See [`docs/plan/MASTER_PLAN.md`](plan/MASTER_PLAN.md) for the full
phase. Headline: invite-only admin auth, property CRUD wizard with
Vercel Blob image upload, leads journal, analytics dashboard. The
public-side `revalidatePropertyPages()` helper in `src/lib/cache.ts`
is ready for the admin mutation routes to call.
