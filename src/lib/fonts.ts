import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';

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

export const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-arabic-loaded',
  preload: true,
});
