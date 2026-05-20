import type { Locale } from '@/i18n/routing';
import type { AdminPropertyImageRow } from '@/lib/data/admin-properties';

import { PropertyImagesGridClient } from './PropertyImagesGridClient';

interface PropertyImagesGridProps {
  locale: Locale;
  propertyId: string;
  images: AdminPropertyImageRow[];
}

/**
 * Admin gallery wrapper for a single property's uploaded images.
 *
 * The render itself is now in [PropertyImagesGridClient] so the tiles
 * can support drag-reorder + set-as-hero (PR 3.5c) without dragging
 * the whole edit page into the client bundle. This stays a server
 * component so callers can keep using the `Promise.all` parallel-fetch
 * pattern in the edit page.
 *
 * Tier: any active admin (the underlying API routes enforce auth).
 */
export function PropertyImagesGrid({ locale, propertyId, images }: PropertyImagesGridProps) {
  return <PropertyImagesGridClient locale={locale} propertyId={propertyId} images={images} />;
}
