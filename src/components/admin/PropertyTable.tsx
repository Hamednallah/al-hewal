import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import type { Locale } from '@/i18n/routing';
import type { AdminSessionPayload } from '@/lib/auth/session';
import type { AdminPropertyRow } from '@/lib/data/admin-properties';
import { formatPrice } from '@/lib/format';

import { RowActionButton } from './RowActionButton';
import { StatusBadge } from './StatusBadge';

interface PropertyTableProps {
  locale: Locale;
  rows: AdminPropertyRow[];
  basePath: string;
  /**
   * Current admin's session — used to decide which row actions render.
   * super_admin sees `feature` + `delete`; standard_admin does not.
   */
  admin: AdminSessionPayload;
}

/**
 * Admin Listing Management table — server-rendered, sortable rows show
 * project name (bilingual title in the active locale), location, price,
 * status, featured flag, last updated, and the contextual row-action
 * group (edit / publish / feature / archive | restore / delete).
 *
 * Pixel reference: `stitch_alhewal_bilingual_corporate_website/
 * admin_listing_management/screen.png`.
 *
 * Tier rules (PR 3.3b):
 *   - `standard_admin` sees edit, publish (when draft), and
 *     archive ↔ restore.
 *   - `super_admin` sees those plus feature / unfeature and the
 *     destructive hard delete.
 *
 * Mutations route through `/api/properties/[id]/<action>` and trigger
 * `router.refresh()` on success; the table is server-rendered, so a
 * refresh re-fetches the current page worth of data.
 */
export async function PropertyTable({ locale, rows, basePath, admin }: PropertyTableProps) {
  const t = await getTranslations({ locale, namespace: 'admin.properties.table' });
  const tType = await getTranslations({ locale, namespace: 'admin.properties.type' });
  const tActions = await getTranslations({ locale, namespace: 'admin.properties.actions' });
  const isSuperAdmin = admin.tier === 'super_admin';

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="bg-canvas-raised border-outline-variant/30 border">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">
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
                    <div
                      className="inline-flex flex-wrap items-start justify-end gap-2"
                      role="group"
                      aria-label={tActions('menuLabel', { title })}
                    >
                      <Link
                        href={`${basePath}/${row.id}/edit`}
                        prefetch={false}
                        className="text-teal-forest-700 border-teal-forest-700/30 hover:bg-teal-forest-700 hover:text-canvas inline-flex items-center border px-2.5 py-1 text-[0.7rem] font-medium tracking-wide transition-colors"
                      >
                        {t('edit')}
                      </Link>
                      {!isArchived && row.status === 'draft' ? (
                        <RowActionButton
                          href={`/api/properties/${row.id}/publish`}
                          method="POST"
                          label={tActions('publish')}
                          failureMessage={tActions('failureToast')}
                        />
                      ) : null}
                      {isSuperAdmin && !isArchived ? (
                        <RowActionButton
                          href={`/api/properties/${row.id}/feature`}
                          method="POST"
                          body={{ featured: !row.featured }}
                          label={row.featured ? tActions('unfeature') : tActions('feature')}
                          failureMessage={tActions('failureToast')}
                        />
                      ) : null}
                      {isArchived ? (
                        <RowActionButton
                          href={`/api/properties/${row.id}/restore`}
                          method="POST"
                          label={tActions('restore')}
                          failureMessage={tActions('failureToast')}
                        />
                      ) : (
                        <RowActionButton
                          href={`/api/properties/${row.id}/archive`}
                          method="POST"
                          label={tActions('archive')}
                          confirmMessage={tActions('archiveConfirm', { title })}
                          tone="destructive"
                          failureMessage={tActions('failureToast')}
                        />
                      )}
                      {isSuperAdmin ? (
                        <RowActionButton
                          href={`/api/properties/${row.id}`}
                          method="DELETE"
                          label={tActions('delete')}
                          confirmMessage={tActions('deleteConfirm', { title })}
                          tone="destructive"
                          failureMessage={tActions('failureToast')}
                        />
                      ) : null}
                    </div>
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
