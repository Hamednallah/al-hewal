import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { FeaturedProjects } from '@/components/public/FeaturedProjects';
import { Hero } from '@/components/public/Hero';
import { TrustBanner } from '@/components/public/TrustBanner';
import { ValueGrid } from '@/components/public/ValueGrid';
import { type Locale } from '@/i18n/routing';

// Build-time evaluated routes read process.env directly, NOT the Zod
// `env` Proxy — the Proxy's first access triggers full server-env
// validation, which is brittle when build-time envs aren't all present.
// NEXT_PUBLIC_* values are inlined by Next at build time anyway.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const WHATSAPP_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? '';

/**
 * Home page composition order:
 *   1. Hero            (full-bleed dark teal, brand statement + CTAs)
 *   2. ValueGrid       (3 numbered cards from alhewal.txt brief)
 *   3. FeaturedProjects (data-driven, empty state covered)
 *   4. TrustBanner     (1-year warranty pitch, leads into footer)
 *
 * force-dynamic. PR #27 tried `revalidate=60 + force-static`, but
 * production logs proved Vercel's CDN edge cache keeps serving the
 * cached HTML well past the revalidate window — owner unfeatured a
 * property and the home kept showing it on the featured carousel.
 * `revalidatePath('/<locale>', 'page')` doesn't reliably evict the
 * edge cache, and longer windows compound the staleness. Going
 * `force-dynamic` so every visit hits Supabase fresh and the carousel
 * always reflects the current `featured=true` set. Free-tier impact
 * stays inside the 100k/mo Function cap by orders of magnitude.
 *
 * Emits a JSON-LD `Organization` schema inline (PR 2.6 / SEO). The
 * `RealEstateListing` schema lives on the property detail page (PR 2.4).
 * Both flow into Google's knowledge graph + rich-results pipeline.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tBrand = await getTranslations({ locale, namespace: 'public.brand' });
  const tHero = await getTranslations({ locale, namespace: 'public.home.hero' });
  const tFooter = await getTranslations({ locale, namespace: 'public.footer' });
  const canonical = `${SITE_URL}/${locale}`;
  const altLocale = locale === 'ar' ? 'en' : 'ar';

  return {
    title: tHero('headline'),
    description: tFooter('about'),
    alternates: {
      canonical,
      languages: {
        'ar-SA': `${SITE_URL}/ar`,
        en: `${SITE_URL}/en`,
        'x-default': `${SITE_URL}/ar`,
      },
    },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: tBrand('name'),
      title: tHero('headline'),
      description: tFooter('about'),
      locale,
      alternateLocale: altLocale,
    },
    twitter: {
      card: 'summary_large_image',
      title: tHero('headline'),
      description: tFooter('about'),
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;
  const [tBrand, tFooter] = await Promise.all([
    getTranslations({ locale, namespace: 'public.brand' }),
    getTranslations({ locale, namespace: 'public.footer' }),
  ]);

  const jsonLd = buildOrganizationJsonLd({
    name: tBrand('name'),
    description: tFooter('about'),
    locale,
  });

  return (
    <>
      <script
        type="application/ld+json"
        // Generated server-side from typed translations — no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero locale={typedLocale} />
      <ValueGrid locale={typedLocale} />
      <FeaturedProjects locale={typedLocale} />
      <TrustBanner locale={typedLocale} />
    </>
  );
}

function buildOrganizationJsonLd({
  name,
  description,
  locale,
}: {
  name: string;
  description: string;
  locale: string;
}) {
  const siteUrl = SITE_URL;
  // E.164 with the validated `+` prefix per WhatsApp / Schema.org
  // convention. WHATSAPP_PHONE is digits-only (regex
  // in env.ts), so we prepend the `+` here.
  const telephone = `+${WHATSAPP_PHONE}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name,
    alternateName: locale === 'ar' ? 'Al Haual' : 'الحوال',
    description,
    url: siteUrl,
    inLanguage: locale,
    areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'SA',
      addressLocality: 'Riyadh',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone,
      contactType: 'sales',
      availableLanguage: ['ar', 'en'],
    },
    sameAs: [`https://wa.me/${WHATSAPP_PHONE}`],
  };
}
