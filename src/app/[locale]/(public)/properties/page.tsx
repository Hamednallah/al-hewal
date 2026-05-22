import { getTranslations, setRequestLocale } from 'next-intl/server';

import { FilterBar } from '@/components/public/FilterBar';
import { Pagination } from '@/components/public/Pagination';
import { PropertyCard } from '@/components/public/PropertyCard';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { listFilterableCities, searchProperties } from '@/lib/data/properties';
import { hasActiveFilters, parseCatalogFilters } from '@/lib/url-filters';

/**
 * Catalog page — `/<locale>/properties`.
 *
 * Server-rendered, filter-by-URL (no client-side fetch). Composition:
 *   - Page header (eyebrow + headline)
 *   - Sticky FilterBar (form submits to this same URL via method=GET)
 *   - Results summary line
 *   - 3-col grid (or empty state)
 *   - Pagination (hidden when totalPages <= 1)
 *
 * Because filters live in searchParams, this route opts out of static
 * generation (each unique URL is a unique render). We use ISR-on-demand
 * with a short cache window so repeat visits to the same URL within
 * the window hit the cache.
 */
export const dynamic = 'force-dynamic';

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, rawSearch] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const typedLocale = locale as Locale;
  const filters = parseCatalogFilters(rawSearch);

  const [result, cities, tResults] = await Promise.all([
    searchProperties(filters),
    listFilterableCities(),
    getTranslations({ locale: typedLocale, namespace: 'public.catalog.results' }),
  ]);

  const showingCount = result.items.length;
  const activeFilters = hasActiveFilters(filters);

  return (
    <>
      <PageHeader locale={typedLocale} />
      <FilterBar locale={typedLocale} filters={filters} cities={cities} />
      <section className="bg-canvas py-12 md:py-16">
        <div className="px-edge mx-auto max-w-[1440px]">
          {result.total > 0 ? (
            <p className="text-charcoal-muted mb-8 text-sm tracking-[0.2em] uppercase">
              {tResults('summary', { showing: showingCount, total: result.total })}
            </p>
          ) : null}

          {result.items.length > 0 ? (
            <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((property, index) => (
                <li key={property.id}>
                  <PropertyCard property={property} priority={index < 3} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState locale={typedLocale} hasFilters={activeFilters}>
              {activeFilters ? tResults('empty') : tResults('emptyNoFilters')}
            </EmptyState>
          )}

          <Pagination locale={typedLocale} filters={filters} totalPages={result.totalPages} />
        </div>
      </section>
    </>
  );
}

async function PageHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'public.catalog' });
  return (
    <header className="bg-teal-forest-700 text-canvas">
      <div className="px-edge mx-auto max-w-[1440px] py-16 md:py-20">
        <p className="text-brass-400 text-sm tracking-[0.4em] uppercase">{t('pageEyebrow')}</p>
        <h1 className="mt-3 text-4xl leading-tight font-bold md:text-5xl">{t('pageTitle')}</h1>
      </div>
    </header>
  );
}

async function EmptyState({
  locale,
  hasFilters,
  children,
}: {
  locale: Locale;
  hasFilters: boolean;
  children: React.ReactNode;
}) {
  const [tFilter, tFooter] = await Promise.all([
    getTranslations({ locale, namespace: 'public.catalog.filter' }),
    getTranslations({ locale, namespace: 'public.footer' }),
  ]);
  return (
    <div className="border-outline-variant text-charcoal-muted flex flex-col items-center gap-6 border p-12 text-center md:p-20">
      <p className="max-w-xl text-base leading-relaxed md:text-lg">{children}</p>
      {hasFilters ? (
        <Button asChild variant="outline" size="md">
          <Link href="/properties" prefetch={false}>
            {tFilter('clear')}
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" size="md">
          <Link href="/contact">{tFooter('linkContact')}</Link>
        </Button>
      )}
    </div>
  );
}
