import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';

import { routing } from '@/i18n/routing';

/**
 * Cache-invalidation helpers consumed by admin mutations in Phase 3.
 *
 * Public pages are ISR-cached with long revalidate windows (24 h for
 * the property detail, 1 h for the home) so an admin publishing a new
 * property would normally wait up to a day before it appears live.
 * These helpers let the admin mutation routes call a single function
 * to force an immediate re-render of every affected surface.
 *
 * Two flavours:
 *
 *   - `revalidatePropertyPages(slug)` — re-renders both
 *     `/<locale>/properties/<slug>` pages, plus the home page and the
 *     catalog index (the property may have been featured / unfeatured).
 *     Use after create, update, or delete of a property.
 *
 *   - `revalidateAfterFeatureToggle()` — re-renders the home + catalog
 *     only, used when an admin flips `featured` / `featured_order`
 *     without otherwise editing the property.
 *
 * Both also fire `revalidateTag('property')` for completeness; this is a
 * no-op today (we don't tag fetches yet) but reserves the tag namespace
 * for the inevitable migration to `'use cache'` + tag-based invalidation
 * once Next 15's stable cache API ships.
 */

export const PROPERTY_TAG = 'property';

export async function revalidatePropertyPages(slug: string): Promise<void> {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/properties/${slug}`, 'page');
    revalidatePath(`/${locale}/properties`, 'page');
    revalidatePath(`/${locale}`, 'page');
  }
  revalidateTag(PROPERTY_TAG);
}

export async function revalidateAfterFeatureToggle(): Promise<void> {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/properties`, 'page');
    revalidatePath(`/${locale}`, 'page');
  }
  revalidateTag(PROPERTY_TAG);
}
