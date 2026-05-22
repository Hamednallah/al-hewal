import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Static "About" page — bilingual marketing copy lifted from
 * `alhewal.txt` (the company brief), translated and split into a
 * mission / promise / values rhythm.
 *
 * `force-static` because the copy lives entirely in the message
 * catalog. ISR `revalidate=86400` so a translation edit eventually
 * appears live even without a deploy.
 */
export const revalidate = 86400;
export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tBrand = await getTranslations({ locale, namespace: 'public.brand' });
  const t = await getTranslations({ locale, namespace: 'public.about' });
  const canonical = `${SITE_URL}/${locale}/about`;
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: {
      canonical,
      languages: {
        'ar-SA': `${SITE_URL}/ar/about`,
        en: `${SITE_URL}/en/about`,
        'x-default': `${SITE_URL}/ar/about`,
      },
    },
    openGraph: {
      type: 'article',
      url: canonical,
      siteName: tBrand('name'),
      title: t('pageTitle'),
      description: t('pageDescription'),
      locale,
    },
  };
}

type Params = { locale: string };

const VALUE_KEYS = ['modern', 'ontime', 'warranty', 'maintenance', 'relationships'] as const;

export default async function AboutPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'public.about' });

  return (
    <article>
      {/* Header band — full-bleed teal, mirrors the catalog page header. */}
      <header className="bg-teal-forest-700 text-canvas">
        <div className="px-edge mx-auto max-w-[1440px] py-16 md:py-24">
          <p className="text-brass-400 text-sm tracking-[0.4em] uppercase">{t('pageEyebrow')}</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-bold text-balance md:text-5xl lg:text-6xl">
            {t('pageTitle')}
          </h1>
          <p className="text-canvas/85 mt-6 max-w-2xl text-base leading-relaxed md:text-lg md:leading-loose">
            {t('pageDescription')}
          </p>
        </div>
      </header>

      {/* Mission / Promise — two-column asymmetric narrative. */}
      <section className="bg-canvas">
        <div className="px-edge mx-auto grid max-w-[1440px] grid-cols-1 gap-12 py-16 md:grid-cols-12 md:gap-10 md:py-24">
          <div className="md:col-span-6">
            <h2 className="text-teal-forest-700 mb-4 text-2xl leading-tight font-semibold md:text-3xl">
              {t('missionTitle')}
            </h2>
            <p className="text-charcoal-muted max-w-prose text-base leading-relaxed md:text-lg md:leading-loose">
              {t('missionBody')}
            </p>
          </div>
          <div className="md:col-span-6">
            <h2 className="text-teal-forest-700 mb-4 text-2xl leading-tight font-semibold md:text-3xl">
              {t('trustTitle')}
            </h2>
            <p className="text-charcoal-muted max-w-prose text-base leading-relaxed md:text-lg md:leading-loose">
              {t('trustBody')}
            </p>
          </div>
        </div>
      </section>

      {/* Values — numbered list (matches the home ValueGrid rhythm). */}
      <section className="bg-canvas-sunken border-outline-variant border-y">
        <div className="px-edge mx-auto max-w-[1440px] py-16 md:py-20">
          <h2 className="text-teal-forest-700 mb-8 text-2xl leading-tight font-semibold md:text-3xl">
            {t('valuesTitle')}
          </h2>
          <ol className="bg-charcoal/10 grid grid-cols-1 gap-px md:grid-cols-5">
            {VALUE_KEYS.map((key, idx) => (
              <li key={key} className="bg-canvas-raised flex flex-col gap-3 p-6 md:p-8">
                <p className="text-teal-forest-700 text-sm font-bold tracking-[0.3em] uppercase">
                  {String(idx + 1).padStart(2, '0')}
                </p>
                <p className="text-charcoal text-base leading-snug font-semibold md:text-lg">
                  {t(`values.${key}`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA strip — teal with brass CTAs, mirrors TrustBanner style. */}
      <section className="bg-teal-forest-700 text-canvas">
        <div className="px-edge mx-auto max-w-[1440px] py-16 md:py-20">
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl leading-tight font-semibold md:text-4xl">{t('ctaTitle')}</h2>
              <p className="text-canvas/85 mt-4 text-base leading-relaxed md:text-lg">
                {t('ctaBody')}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="secondary" size="md">
                <Link href="/properties">{t('ctaProjects')}</Link>
              </Button>
              <Button asChild variant="ghost" size="md">
                <Link href="/contact">{t('ctaContact')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
