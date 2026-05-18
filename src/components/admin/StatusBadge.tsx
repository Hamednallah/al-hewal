import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

import type { AdminPropertyStatus } from '@/lib/data/admin-properties';

type DisplayStatus = AdminPropertyStatus | 'archived';

interface StatusBadgeProps {
  locale: Locale;
  status: AdminPropertyStatus;
  isArchived?: boolean;
}

/**
 * Coloured pill rendered in the listings table's status column.
 *
 * Palette is locked to the brand tokens: brass for "in market", teal-
 * forest for "live and selling", warm grey for "pre-launch", muted grey
 * for "off the market". Status colours intentionally stay within the
 * sharp-rectangle visual vocabulary (no rounded pill, no shadow).
 *
 * Archived is a derived status: when `isArchived` is true (i.e. the row
 * has `deleted_at != null`), it overrides the underlying status. The
 * actual status remains queryable for the un-archive flow in PR 3.3b.
 */
const STYLES: Record<DisplayStatus, string> = {
  draft: 'bg-canvas-deep text-charcoal-muted',
  available: 'bg-brass-100 text-brass-800',
  starting_soon: 'bg-canvas-sunken text-teal-forest-700',
  reserved: 'bg-secondary-fixed text-on-secondary-fixed',
  sold: 'bg-teal-forest-700 text-canvas',
  archived: 'bg-charcoal-muted text-canvas',
};

export async function StatusBadge({ locale, status, isArchived = false }: StatusBadgeProps) {
  const t = await getTranslations({ locale, namespace: 'admin.properties.status' });
  const display: DisplayStatus = isArchived ? 'archived' : status;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 text-xs font-medium tracking-wide whitespace-nowrap',
        STYLES[display],
      )}
    >
      {t(display)}
    </span>
  );
}
