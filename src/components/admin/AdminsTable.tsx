import { getTranslations } from 'next-intl/server';

import { AdminStatusBadge } from './AdminStatusBadge';
import { AdminTierBadge } from './AdminTierBadge';
import { RowActionButton } from './RowActionButton';
import type { Locale } from '@/i18n/routing';
import type { AdminListRow } from '@/lib/data/admins';

interface AdminsTableProps {
  locale: Locale;
  rows: AdminListRow[];
  /** Calling admin's id — used to suppress destructive row actions on self. */
  selfId: string;
}

/**
 * Server-rendered admin-management list. Mirrors the property card
 * pattern from `PropertyTable.tsx` so the chrome stays consistent
 * across the Command Center.
 *
 * Row actions are super_admin-only at the page level (the page itself
 * redirects standard_admins back to the dashboard). We additionally
 * suppress destructive actions on the calling admin's own row so a
 * super_admin can't accidentally demote / deactivate themselves into
 * an org with no super_admins.
 */
export async function AdminsTable({ locale, rows, selfId }: AdminsTableProps) {
  const t = await getTranslations({ locale, namespace: 'admin.admins' });
  const tTier = await getTranslations({ locale, namespace: 'admin.admins.tier' });
  const tStatus = await getTranslations({ locale, namespace: 'admin.admins.status' });
  const tActions = await getTranslations({ locale, namespace: 'admin.admins.actions' });
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <ul data-testid="admins-cards" className="flex flex-col gap-3">
      {rows.map((row) => {
        const isSelf = row.id === selfId;
        const isSuper = row.tier === 'super_admin';
        const isActive = row.status === 'active';
        const isPending = row.status === 'pending_invite';
        const lastLogin = row.last_login_at
          ? dateFmt.format(new Date(row.last_login_at))
          : t('lastLoginNever');

        return (
          <li
            key={row.id}
            data-testid={`admin-row-${row.id}`}
            className="bg-canvas-raised border-outline-variant/30 hover:border-teal-forest-700/40 flex flex-col gap-4 border p-4 transition-colors md:p-5"
          >
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-teal-forest-700 truncate text-base font-semibold">
                  {row.full_name}
                  {isSelf ? (
                    <span className="text-charcoal-muted ms-2 text-xs font-normal">
                      ({t('youLabel')})
                    </span>
                  ) : null}
                </p>
                <p className="text-charcoal-muted truncate text-xs" dir="ltr">
                  {row.email}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                <AdminTierBadge tier={row.tier} label={tTier(row.tier)} />
                <AdminStatusBadge status={row.status} label={tStatus(row.status)} />
              </div>
            </header>

            <dl className="text-charcoal grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-charcoal-muted text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
                  {t('field_lastLogin')}
                </dt>
                <dd className="text-sm">{lastLogin}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-charcoal-muted text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
                  {t('field_languagePref')}
                </dt>
                <dd className="text-sm">{row.language_pref === 'ar' ? 'العربية' : 'English'}</dd>
              </div>
            </dl>

            <div
              className="border-outline-variant/30 flex flex-wrap items-start gap-2 border-t pt-3"
              role="group"
              aria-label={tActions('menuLabel', { name: row.full_name })}
            >
              {!isSelf && !isPending ? (
                <RowActionButton
                  href={`/api/admins/${row.id}/${isSuper ? 'demote' : 'promote'}`}
                  method="POST"
                  label={isSuper ? tActions('demote') : tActions('promote')}
                  failureMessage={tActions('failureToast')}
                />
              ) : null}
              {!isSelf && isActive ? (
                <RowActionButton
                  href={`/api/admins/${row.id}/deactivate`}
                  method="POST"
                  label={tActions('deactivate')}
                  confirmMessage={tActions('deactivateConfirm', { name: row.full_name })}
                  tone="destructive"
                  failureMessage={tActions('failureToast')}
                />
              ) : null}
              {!isSelf && row.status === 'deactivated' ? (
                <RowActionButton
                  href={`/api/admins/${row.id}/reactivate`}
                  method="POST"
                  label={tActions('reactivate')}
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
