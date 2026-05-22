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
 * Admin Listing Management — server-rendered list of property cards.
 *
 * Pixel reference: `stitch_alhewal_bilingual_corporate_website/
 * admin_listing_management/screen.png`.
 *
 * Layout (PR phase-3-ux-papercuts): single-column card list at every
 * viewport, replacing the desktop table. Each card stacks: title/slug
 * header → data row (type · location · price · status · featured ·
 * updated) → full-width action group below. Same data density as the
 * old table on desktop, but renders cleanly on mobile without
 * horizontal-scroll or wrap-stacking action buttons. The component
 * name is retained for import-stability — the markup is the change.
 *
 * Tier rules (PR 3.3b):
 *   - `standard_admin` sees edit, publish (when draft), and
 *     archive ↔ restore.
 *   - `super_admin` sees those plus feature / unfeature and the
 *     destructive hard delete.
 *
 * Mutations route through `/api/properties/[id]/<action>` and trigger
 * `router.refresh()` on success; the list is server-rendered, so a
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
    <ul data-testid="admin-properties-cards" className="flex flex-col gap-3">
      {rows.map((row) => {
        const title = locale === 'ar' ? row.title_ar : row.title_en;
        const isArchived = row.deleted_at !== null;
        const updated = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(new Date(row.updated_at));
        const location = row.district ? `${row.district} · ${row.city}` : row.city;

        return (
          <li
            key={row.id}
            className="bg-canvas-raised border-outline-variant/30 hover:border-teal-forest-700/40 flex flex-col gap-4 border p-4 transition-colors md:p-5"
          >
            {/* Header — title + slug */}
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-teal-forest-700 truncate text-base font-semibold">{title}</p>
                <p className="text-charcoal-muted truncate text-xs">{row.slug}</p>
              </div>
              <StatusBadge locale={locale} status={row.status} isArchived={isArchived} />
            </header>

            {/* Data row — type, location, price, featured, updated */}
            <dl className="text-charcoal grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
              <CardField label={t('type')} value={tType(row.type)} />
              <CardField label={t('location')} value={location} />
              <CardField label={t('price')} value={formatPrice(row.price_sar, locale)} emphasis />
              <CardField label={t('updated')} value={updated} />
            </dl>

            {row.featured ? (
              <p className="text-brass-700 inline-flex items-center gap-1 text-sm font-semibold tracking-wide uppercase">
                ★ {t('featuredYes')}
              </p>
            ) : null}

            {/* Actions row — full width below */}
            <div
              className="border-outline-variant/30 flex flex-wrap items-start gap-2 border-t pt-3"
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
          </li>
        );
      })}
    </ul>
  );
}

interface CardFieldProps {
  label: string;
  value: string;
  emphasis?: boolean;
}

function CardField({ label, value, emphasis }: CardFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-charcoal-muted text-sm font-semibold tracking-[0.16em] uppercase">
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? 'text-charcoal text-base font-semibold whitespace-nowrap'
            : 'text-charcoal text-sm'
        }
      >
        {value}
      </dd>
    </div>
  );
}
