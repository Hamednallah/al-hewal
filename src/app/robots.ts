import type { MetadataRoute } from 'next';

/**
 * /robots.txt — explicit allowlist for the public catalog and a
 * blanket disallow on every admin / API / auth surface.
 *
 * Why explicit disallow instead of meta robots on the admin pages:
 * a hostile crawler that ignores `<meta name="robots">` will still
 * respect robots.txt (most do, including LLM scrapers). The lead-
 * capture and admin URLs must never appear in search results both
 * to protect the funnel and to avoid leaking the admin URL surface.
 *
 * `sitemap` points at the sister sitemap.ts route so crawlers
 * auto-discover every property page on first visit.
 *
 * Uses `process.env.NEXT_PUBLIC_SITE_URL` directly (not the Zod
 * `env` Proxy) because this route is evaluated at build time, where
 * the Proxy's first access triggers full server-env validation —
 * brittle when build-time envs aren't all present. The public site
 * URL is inlined by Next at build and validated by the layout.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/auth/', '/*?*_alh_v=', '/_next/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
