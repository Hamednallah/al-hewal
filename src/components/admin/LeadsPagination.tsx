import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import type { Locale } from '@/i18n/routing';
import { type AdminLeadFilters, serializeAdminLeadFilters } from '@/lib/data/admin-leads';

interface LeadsPaginationProps {
  locale: Locale;
  filters: AdminLeadFilters;
  totalPages: number;
  totalRows: number;
  basePath: string;
}

/**
 * Pagination for the Leads Journal — mirrors `AdminPagination`'s
 * shape but binds to the leads filter type + i18n namespace.
 */
export async function LeadsPagination({
  locale,
  filters,
  totalPages,
  totalRows,
  basePath,
}: LeadsPaginationProps) {
  const t = await getTranslations({ locale, namespace: 'admin.properties.pagination' });
  if (totalRows === 0) return null;
  const { page } = filters;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const linkFor = (target: number) => {
    const qs = serializeAdminLeadFilters({ ...filters, page: target }).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav
      aria-label={t('pageOf', { current: page, total: totalPages })}
      className="border-outline-variant/40 bg-canvas-raised flex items-center justify-between gap-4 border-t px-6 py-4 md:px-10"
    >
      <p className="text-charcoal-muted text-sm tracking-[0.18em] uppercase">
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
      className="border-outline-variant text-teal-forest-700 hover:bg-canvas-sunken border px-3 py-2 text-sm font-medium"
    >
      {label}
    </Link>
  );
}
