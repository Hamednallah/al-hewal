import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { PropertyCard } from '@/components/public/PropertyCard';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { getFeaturedProperties } from '@/lib/data/properties';

/**
 * Featured projects section for the home page.
 *
 * Renders up to 6 featured properties as a 3-column grid (single column
 * mobile). Falls back to an empty-state explainer when no properties
 * are featured — the seed file is local-only per the project rule, so
 * the deployed Vercel build will hit this empty state until Phase 3
 * admin uploads real properties (see project_seed_local_only memory).
 *
 * Server component. Data fetch is wrapped in `getFeaturedProperties`
 * which try/catches transport failures and returns `[]` — so a
 * misconfigured env in CI / preview cannot crash the build.
 */
export async function FeaturedProjects({ locale }: { locale: Locale }) {
  const [properties, t, tFooter] = await Promise.all([
    getFeaturedProperties(6),
    getTranslations({ locale, namespace: 'public.home.featured' }),
    getTranslations({ locale, namespace: 'public.footer' }),
  ]);

  return (
    <section className="bg-canvas-sunken py-section">
      <div className="mx-auto max-w-[1440px] px-edge">
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-teal-forest-500 text-xs uppercase tracking-[0.4em]">
              {t('eyebrow')}
            </p>
            <h2 className="text-charcoal text-balance text-3xl font-bold leading-tight md:text-5xl">
              {t('headline')}
            </h2>
          </div>
          {properties.length > 0 ? (
            <Button asChild variant="outline" size="md">
              <Link href="/properties">{t('viewAll')}</Link>
            </Button>
          ) : null}
        </div>

        {properties.length > 0 ? (
          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property, index) => (
              <li key={property.id}>
                {/* The first 3 cards are LCP-eligible on desktop; mark them
                    priority so next/image preloads + uses fetchpriority. */}
                <PropertyCard property={property} priority={index < 3} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            message={t('empty')}
            cta={
              <Button asChild variant="outline" size="md">
                <Link href="/contact">{tFooter('linkContact')}</Link>
              </Button>
            }
          />
        )}
      </div>
    </section>
  );
}

function EmptyState({ message, cta }: { message: string; cta: ReactNode }) {
  return (
    <div className="border-outline-variant text-charcoal-muted flex flex-col items-center gap-6 border p-12 text-center md:p-20">
      <p className="max-w-xl text-base leading-relaxed md:text-lg">{message}</p>
      {cta}
    </div>
  );
}
