import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import type { Locale } from '@/i18n/routing';
import type { AdminPropertyRow } from '@/lib/data/admin-properties';
import { formatPrice } from '@/lib/format';

import { StatusBadge } from './StatusBadge';

interface PropertyTableProps {
  locale: Locale;
  rows: AdminPropertyRow[];
  basePath: string;
}

/**
 * Admin Listing Management table — server-rendered, sortable rows show
 * project name (bilingual title in the active locale), location, price,
 * status, featured flag, last updated, and a contextual edit link.
 *
 * Pixel reference: `stitch_alhewal_bilingual_corporate_website/
 * admin_listing_management/screen.png`. The mockup's row actions
 * (edit / publish / archive / delete) are deferred to PR 3.3b — this
 * first cut ships read-only access so admins can browse + filter the
 * inventory immediately.
 *
 * Row hover lifts the row above the table grid and surfaces the edit
 * link as the primary affordance. Mutation actions arrive once the
 * `/api/admin/properties/[id]/<action>` routes land.
 */
export async function PropertyTable({ locale, rows, basePath }: PropertyTableProps) {
  const t = await getTranslations({ locale, namespace: 'admin.properties.table' });
  const tType = await getTranslations({ locale, namespace: 'admin.properties.type' });

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="bg-canvas-raised border-outline-variant/30 border">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas-sunken text-charcoal-muted text-xs tracking-[0.18em] uppercase">
            <tr>
              <th scope="col" className="px-6 py-4 font-semibold">
                {t('project')}
              </th>
              <th scope="col" className="px-6 py-4 font-semibold">
                {t('type')}
              </th>
              <th scope="col" className="px-6 py-4 font-semibold">
                {t('location')}
              </th>
              <th scope="col" className="px-6 py-4 font-semibold">
                {t('price')}
              </th>
              <th scope="col" className="px-6 py-4 font-semibold">
                {t('status')}
              </th>
              <th scope="col" className="px-6 py-4 font-semibold">
                {t('featured')}
              </th>
              <th scope="col" className="px-6 py-4 font-semibold">
                {t('updated')}
              </th>
              <th scope="col" className="px-6 py-4 text-end font-semibold">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const title = locale === 'ar' ? row.title_ar : row.title_en;
              const isArchived = row.deleted_at !== null;
              const updated = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }).format(new Date(row.updated_at));
              return (
                <tr
                  key={row.id}
                  className="border-outline-variant/30 hover:bg-canvas-sunken/40 border-t transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-teal-forest-700 font-semibold">{title}</p>
                    <p className="text-charcoal-muted text-xs">{row.slug}</p>
                  </td>
                  <td className="text-charcoal px-6 py-4 whitespace-nowrap">{tType(row.type)}</td>
                  <td className="text-charcoal px-6 py-4">
                    <p className="font-medium">{row.city}</p>
                    {row.district ? (
                      <p className="text-charcoal-muted text-xs">{row.district}</p>
                    ) : null}
                  </td>
                  <td className="text-charcoal px-6 py-4 font-medium whitespace-nowrap">
                    {formatPrice(row.price_sar, locale)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge locale={locale} status={row.status} isArchived={isArchived} />
                  </td>
                  <td className="px-6 py-4">
                    {row.featured ? (
                      <span className="text-brass-700 inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase">
                        ★ {t('featuredYes')}
                      </span>
                    ) : (
                      <span className="text-charcoal-muted/60 text-xs">{t('featuredNo')}</span>
                    )}
                  </td>
                  <td className="text-charcoal-muted px-6 py-4 text-xs whitespace-nowrap">
                    {updated}
                  </td>
                  <td className="px-6 py-4 text-end">
                    <Link
                      href={`${basePath}/${row.id}/edit`}
                      prefetch={false}
                      className="text-teal-forest-700 border-teal-forest-700/30 hover:bg-teal-forest-700 hover:text-canvas inline-flex items-center border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors"
                    >
                      {t('edit')}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
