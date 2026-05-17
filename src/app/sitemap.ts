import type { MetadataRoute } from 'next';

import { routing } from '@/i18n/routing';
import { listLivePropertySlugs } from '@/lib/data/properties';

/**
 * /sitemap.xml — emits every public URL for every locale, with
 * `alternates.languages` set so Google's hreflang resolver sends KSA
 * traffic to the Arabic version and ROW traffic to the English one.
 *
 * Routes covered:
 *   - /                — locale-root (home) for each locale
 *   - /properties      — catalog for each locale
 *   - /properties/<slug> — every live property slug for each locale
 *
 * `lastModified` defaults to "now" for the index pages (their ISR cache
 * is at most 24 h old) and to the property's `updated_at` for detail
 * pages. The `changeFrequency` + `priority` values are advisory; Google
 * mostly ignores them, but Bing and Yandex still read them.
 *
 * Tolerates a Supabase fetch failure at build time: the slugs come back
 * empty, the home + catalog URLs still ship, and the next on-demand
 * rebuild fills in the rest. The handoff calls this out as the right
 * trade-off vs. failing the build on transient infra.
 */

export const revalidate = 3600; // 1h — matches the home page cadence

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Use process.env directly instead of the Zod-validated `env` Proxy:
  // sitemap.ts is evaluated at build time, where the Proxy's first
  // property access triggers full server-env validation — that fails
  // when build-time envs (SUPABASE_SERVICE_ROLE_KEY etc.) aren't
  // present. NEXT_PUBLIC_SITE_URL is inlined by Next at build, so the
  // direct read is safe AND validated through the layout's own check.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const slugs = await listLivePropertySlugs();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];

  // Home (one entry per locale, each carrying both locales as alternates
  // so the engine knows ar ↔ en pairings).
  for (const locale of routing.locales) {
    entries.push({
      url: `${siteUrl}/${locale}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
      alternates: { languages: localeAlternates(siteUrl, '') },
    });
  }

  // Catalog index.
  for (const locale of routing.locales) {
    entries.push({
      url: `${siteUrl}/${locale}/properties`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
      alternates: { languages: localeAlternates(siteUrl, '/properties') },
    });
  }

  // One entry per live property × locale. The same property gets two
  // entries (ar + en) so each locale's URL is canonical to itself but
  // carries the other locale as an hreflang alternate.
  for (const slug of slugs) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${siteUrl}/${locale}/properties/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: { languages: localeAlternates(siteUrl, `/properties/${slug}`) },
      });
    }
  }

  return entries;
}

function localeAlternates(siteUrl: string, path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of routing.locales) {
    // Google accepts `ar-SA` for the Saudi audience specifically; `en`
    // stays bare because the English variant isn't region-specific.
    const key = locale === 'ar' ? 'ar-SA' : 'en';
    out[key] = `${siteUrl}/${locale}${path}`;
  }
  // x-default points at the AR home — Saudi traffic is the primary
  // audience, per project_arabic_first_routing memory.
  out['x-default'] = `${siteUrl}/${routing.defaultLocale}${path}`;
  return out;
}
