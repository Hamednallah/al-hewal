import { setRequestLocale } from 'next-intl/server';

import { FeaturedProjects } from '@/components/public/FeaturedProjects';
import { Hero } from '@/components/public/Hero';
import { TrustBanner } from '@/components/public/TrustBanner';
import { ValueGrid } from '@/components/public/ValueGrid';
import { type Locale } from '@/i18n/routing';

/**
 * Home page composition order:
 *   1. Hero            (full-bleed dark teal, brand statement + CTAs)
 *   2. ValueGrid       (3 numbered cards from alhewal.txt brief)
 *   3. FeaturedProjects (data-driven, empty state covered)
 *   4. TrustBanner     (1-year warranty pitch, leads into footer)
 *
 * ISR with `revalidate=3600` so the page is regenerated at most once
 * per hour. Phase 2.5 will revalidate on-demand from the admin property
 * mutation endpoints via revalidateTag, so freshly-published featured
 * properties surface immediately instead of waiting an hour.
 *
 * `force-static` rendering tells Next.js this page does not vary per
 * request beyond the [locale] param — the featured query reads from
 * the build-time / first-request snapshot, not per visitor.
 */
export const revalidate = 3600;
export const dynamic = 'force-static';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;

  return (
    <>
      <Hero locale={typedLocale} />
      <ValueGrid locale={typedLocale} />
      <FeaturedProjects locale={typedLocale} />
      <TrustBanner locale={typedLocale} />
    </>
  );
}
