import { IBM_Plex_Sans, Tajawal } from 'next/font/google';

/**
 * IBM Plex Sans (Latin) — loaded via next/font so the font file is
 * self-hosted, served from the same origin as the site, and emitted with
 * `font-display: swap` so the first paint never blocks on font download.
 *
 * `display: 'swap'` keeps the LCP fast; `preload: true` only on the
 * default-locale font tree avoids fetching the other locale's font on
 * first paint.
 */
export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans-loaded',
  preload: true,
});

/**
 * Tajawal — modern Saudi-designed Arabic + Latin sans serif. Picked as
 * the closest free Google-Fonts substitute for Khat Thmanyah (the
 * owner's preferred font), which doesn't have a Google-Fonts release.
 * Tajawal is widely used across the KSA market and pairs cleanly with
 * IBM Plex Sans on the Latin side.
 *
 * Weights map to the same semantic stops we use in classes
 * (`font-medium`, `font-semibold`, `font-bold`). Tajawal has no 600
 * cut, so 500 covers `font-semibold` — visually close to IBM Plex's
 * 600 cut at the sizes the site uses.
 */
export const tajawalArabic = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-arabic-loaded',
  preload: true,
});
