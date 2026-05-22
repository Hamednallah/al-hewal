import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { type CatalogFilters, serializeCatalogFilters } from '@/lib/url-filters';

/**
 * Catalog pagination control.
 *
 * Server component. Renders Previous + Next links (locale-aware) plus a
 * compact "Page X of Y" status. Both links preserve the active filter
 * set via serializeCatalogFilters so users do not lose their filters
 * when paginating.
 *
 * The disabled state on edge pages uses `aria-disabled` + visually
 * dimmed styling — better than removing the element so the layout
 * does not jump between pages.
 *
 * For totalPages <= 1 we render nothing (no pagination needed).
 */
type PaginationProps = {
  locale: Locale;
  filters: CatalogFilters;
  totalPages: number;
};

export async function Pagination({ locale, filters, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;
  const t = await getTranslations({ locale, namespace: 'public.catalog.pagination' });
  const { page } = filters;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const linkFor = (targetPage: number) => {
    const qs = serializeCatalogFilters({ ...filters, page: targetPage });
    return qs ? `/properties?${qs}` : '/properties';
  };

  return (
    <nav
      aria-label={t('pageOf', { current: page, total: totalPages })}
      className="border-outline-variant text-charcoal flex items-center justify-between gap-4 border-t py-8"
    >
      <PaginationLink
        href={linkFor(page - 1)}
        enabled={hasPrev}
        label={t('previous')}
        direction="prev"
      />
      <p className="text-charcoal-muted text-sm uppercase tracking-[0.25em] md:text-sm">
        {t('pageOf', { current: page, total: totalPages })}
      </p>
      <PaginationLink href={linkFor(page + 1)} enabled={hasNext} label={t('next')} direction="next" />
    </nav>
  );
}

function PaginationLink({
  href,
  enabled,
  label,
  direction,
}: {
  href: string;
  enabled: boolean;
  label: string;
  direction: 'prev' | 'next';
}) {
  const className = cn(
    'inline-flex items-center gap-2 border px-4 py-2 text-sm font-bold uppercase tracking-[0.2em] transition-colors md:text-sm',
    enabled
      ? 'border-teal-forest-500 text-teal-forest-700 hover:bg-teal-forest-700 hover:text-canvas'
      : 'border-outline-variant text-charcoal-muted/40 pointer-events-none',
  );
  if (!enabled) {
    return (
      <span aria-disabled="true" className={className}>
        {direction === 'prev' ? <span aria-hidden="true">‹</span> : null}
        {label}
        {direction === 'next' ? <span aria-hidden="true">›</span> : null}
      </span>
    );
  }
  return (
    <Link href={href} className={className} prefetch={false}>
      {direction === 'prev' ? <span aria-hidden="true">‹</span> : null}
      {label}
      {direction === 'next' ? <span aria-hidden="true">›</span> : null}
    </Link>
  );
}
