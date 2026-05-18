import type { MetadataRoute } from 'next';

/**
 * Single brand-wide web manifest served at `/manifest.webmanifest`. Bilingual
 * surfaces use the Arabic short name as primary (AR is the default locale of
 * the site); browsers respect the user's `Accept-Language` for the rendered
 * `lang`-tagged tab title and override these defaults when launched from a
 * locale-specific URL.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Al Hewal — الحوال',
    short_name: 'Al Hewal',
    description: 'Al Hewal Real Estate Development and Investment — Saudi residential projects.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9f9f9',
    theme_color: '#002b2b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
