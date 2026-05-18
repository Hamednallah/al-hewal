import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import type { Locale } from '@/i18n/routing';
import {
  type AdminPropertyFilters,
  serializeAdminPropertyFilters,
} from '@/lib/data/admin-properties';
import { cn } from '@/lib/utils';

interface AdminPaginationProps {
  locale: Locale;
  filters: AdminPropertyFilters;
  totalPages: number;
  totalRows: number;
  basePath: string;
}

/**
 * Pagination control for the admin properties table.
 *
 * Pure server component, no client JS. Mirrors the public catalog
 * Pagination shape so the visual rhythm matches across the app, but
 * uses raw paths instead of `next-intl/navigation` because the admin
 * tree's URLs already include the locale segment.
 */
export async function AdminPagination({
  locale,
  filters,
  totalPages,
  totalRows,
  basePath,
}: AdminPaginationProps) {
  const t = await getTranslations({ locale, namespace: 'admin.properties.pagination' });
  const { page } = filters;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const linkFor = (targetPage: number) => {
    const qs = serializeAdminPropertyFilters({ ...filters, page: targetPage });
    return qs ? `${basePath}?${qs}` : basePath;
  };

  if (totalRows === 0) return null;

  return (
    <nav
      aria-label={t('pageOf', { current: page, total: totalPages })}
      className="border-outline-variant/40 bg-canvas-raised flex items-center justify-between gap-4 border-t px-6 py-4 md:px-10"
    >
      <p className="text-charcoal-muted text-xs tracking-[0.18em] uppercase">
        {t('showing', { current: page, total: totalPages, rows: totalRows })}
      </p>
      <div className="flex items-center gap-2">
        <PaginationLink href={linkFor(page - 1)} enabled={hasPrev} label={t('previous')} />
        <PaginationLink href={linkFor(page + 1)} enabled={hasNext} label={t('next')} />
      </div>
    </nav>
  );
}

function PaginationLink({
  href,
  enabled,
  label,
}: {
  href: string;
  enabled: boolean;
  label: string;
}) {
  if (!enabled) {
    return (
      <span
        aria-disabled="true"
        className="text-charcoal-muted/60 border-outline-variant border px-3 py-2 text-sm"
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        'border-outline-variant text-teal-forest-700 hover:bg-canvas-sunken border px-3 py-2 text-sm font-medium',
      )}
    >
      {label}
    </Link>
  );
}
