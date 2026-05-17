import { defineRouting } from 'next-intl/routing';

/**
 * Locale routing for the Al Hewal platform.
 *
 * - Default locale is Arabic (Saudi-first audience).
 * - `localePrefix: 'always'` means BOTH locales are URL-prefixed
 *   (`/ar/...` and `/en/...`). The bare `/` redirects to `/ar`.
 *   This keeps URL semantics symmetric and avoids the `hreflang`
 *   ambiguity of having one locale at the root and the other prefixed.
 * - `localeDetection: false` is INTENTIONAL — we ignore the browser's
 *   `Accept-Language` header so `/` always lands on `/ar` regardless of
 *   visitor language. Al Hewal's product owner wants the Arabic version
 *   shown by default; visitors with English browsers opt in via the
 *   language switcher in the navbar. Setting this to `true` reintroduces
 *   the bug where an `en-US` browser silently lands on `/en` and never
 *   sees the Arabic brand presence.
 */
export const routing = defineRouting({
  locales: ['ar', 'en'] as const,
  defaultLocale: 'ar',
  localePrefix: 'always',
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (routing.locales as readonly string[]).includes(value);

/**
 * Resolve the writing direction for a locale. Used to set `<html dir>`
 * and to drive RTL-aware utility classes.
 */
export const getDirection = (locale: Locale): 'rtl' | 'ltr' => (locale === 'ar' ? 'rtl' : 'ltr');
