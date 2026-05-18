import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { PropertyAdminFilterBar } from '@/components/admin/PropertyAdminFilterBar';
import { PropertyTable } from '@/components/admin/PropertyTable';
import { Button } from '@/components/ui/button';
import { type Locale, routing } from '@/i18n/routing';
import {
  getAdminDistinctCities,
  listAdminProperties,
  parseAdminPropertyFilters,
} from '@/lib/data/admin-properties';
import { requireAdmin } from '@/lib/auth/admins';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return { robots: { index: false, follow: false } };
  }
  const t = await getTranslations({ locale, namespace: 'admin.pages.properties' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AdminPropertiesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const admin = await requireAdmin();
  const typedLocale = locale as Locale;
  const basePath = `/${typedLocale}/admin/properties`;
  const newPath = `${basePath}/new`;

  const raw = await searchParams;
  const filters = parseAdminPropertyFilters(raw);

  const [{ rows, total, totalPages }, cities, t, tCommon, tEmpty] = await Promise.all([
    listAdminProperties(filters),
    getAdminDistinctCities(),
    getTranslations({ locale: typedLocale, namespace: 'admin.pages.properties' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.common' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.properties.empty' }),
  ]);

  const subtitleWithCount =
    total > 0 ? t('subtitleWithCount', { total, filtered: rows.length }) : t('subtitle');

  return (
    <>
      <AdminTopbar
        eyebrow={tCommon('section')}
        title={t('title')}
        subtitle={subtitleWithCount}
        actions={
          <Button asChild variant="secondary" size="md">
            <Link href={newPath} prefetch={false}>
              + {tCommon('addNewProperty')}
            </Link>
          </Button>
        }
      />
      <PropertyAdminFilterBar locale={typedLocale} filters={filters} cities={cities} />
      <div className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-screen-2xl">
          {rows.length === 0 ? (
            <EmptyState
              title={tEmpty('title')}
              body={tEmpty('body')}
              ctaLabel={tEmpty('ctaLabel')}
              ctaHref={newPath}
            />
          ) : (
            <PropertyTable locale={typedLocale} rows={rows} basePath={basePath} admin={admin} />
          )}
          <AdminPagination
            locale={typedLocale}
            filters={filters}
            totalPages={totalPages}
            totalRows={total}
            basePath={basePath}
          />
        </div>
      </div>
    </>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

function EmptyState({ title, body, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <section
      data-testid="admin-properties-empty"
      className="bg-canvas-raised border-outline-variant/30 flex flex-col items-center gap-4 border p-12 text-center"
    >
      <h2 className="text-teal-forest-700 text-xl font-semibold">{title}</h2>
      <p className="text-charcoal-muted max-w-md text-sm leading-relaxed">{body}</p>
      <Button asChild variant="secondary" size="md" className="mt-2">
        <Link href={ctaHref} prefetch={false}>
          + {ctaLabel}
        </Link>
      </Button>
    </section>
  );
}
