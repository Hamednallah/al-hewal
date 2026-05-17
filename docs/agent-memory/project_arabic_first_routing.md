---
name: project-arabic-first-routing
description: 'Al Hewal is Saudi-first — `/` always lands on `/ar` regardless of browser language. Do NOT re-enable next-intl localeDetection'
metadata:
  node_type: memory
  type: project
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

`src/i18n/routing.ts` sets `localeDetection: false` deliberately. Bare `/` redirects to `/ar` for every visitor.

**Why:** the product owner is a KSA real-estate developer targeting Arabic-speaking buyers. A visitor with an `Accept-Language: en-US` browser (still common in KSA — many users install Chrome in English even when they speak Arabic) was silently being routed to `/en` and never seeing the Arabic brand presence. This was caught in the first CI Playwright run (which sets en-US by default) and the fix was a unit-test-protected invariant.

**How to apply:**

- Never set `localeDetection: true` in `src/i18n/routing.ts`. If you do, the unit test in `tests/unit/i18n/routing.test.ts` will fail with a clear regression-guard error message.
- The English version is opt-in via the language switcher in the nav bar.
- All meta tags still include `hreflang="en"` so Google can serve the right locale to English-search-intent traffic — `localeDetection: false` only affects the bare-`/` redirect, not SEO.
- For documentation: `localePrefix: 'always'` keeps URLs symmetric — both `/ar/...` and `/en/...` exist; nothing lives at the root.
