import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Server-only readers + writer for the property-amenities join.
 *
 * Background — PR 3.4 shipped the admin PropertyForm with the
 * amenities step deferred ("queued as a follow-up"). The public
 * property-detail page reads `property_amenities` via Supabase
 * join, but the admin had no UI to actually set them — so the
 * AmenitiesList section was always empty in production. PR 5-B
 * closes that gap with a checkbox-grid editor on the property
 * edit page.
 *
 * Service-role client so RLS doesn't interfere with the admin
 * mutation; the calling route always re-checks `requireAdmin()`.
 */

export type AmenityCategory = 'interior' | 'exterior' | 'smart' | 'safety';

export interface AdminAmenity {
  id: number;
  key: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  category: AmenityCategory | null;
}

/**
 * Read the full seeded amenities catalog (20 rows as of
 * `0002_rls.sql`). Ordered by category then alphabetical-by-label-EN
 * for stable test output + intuitive grouping in the UI.
 */
export async function listAmenities(): Promise<AdminAmenity[]> {
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from('amenities')
      .select('id, key, label_ar, label_en, icon, category')
      .order('category', { ascending: true })
      .order('label_en', { ascending: true })
      .abortSignal(AbortSignal.timeout(3000));
    if (error) {
      console.warn('[listAmenities] supabase error:', error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      id: row.id as number,
      key: (row as { key: string }).key,
      labelAr: (row as { label_ar: string }).label_ar,
      labelEn: (row as { label_en: string }).label_en,
      icon: (row as { icon: string }).icon,
      category: (row as { category: AmenityCategory | null }).category,
    }));
  } catch (err) {
    console.warn('[listAmenities] unexpected failure:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Read the set of amenity IDs currently linked to one property.
 * Returns an empty array on any failure so the editor can render
 * with all boxes unchecked rather than blocking the page.
 */
export async function getPropertyAmenityIds(propertyId: string): Promise<number[]> {
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from('property_amenities')
      .select('amenity_id')
      .eq('property_id', propertyId)
      .abortSignal(AbortSignal.timeout(3000));
    if (error) {
      console.warn('[getPropertyAmenityIds] supabase error:', error.message);
      return [];
    }
    return (data ?? []).map((row) => (row as { amenity_id: number }).amenity_id);
  } catch (err) {
    console.warn(
      '[getPropertyAmenityIds] unexpected failure:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Replace a property's amenity set with the given list. Two-step:
 *   1. Delete every existing row for the property.
 *   2. Insert the new rows.
 *
 * This is not atomic in a strict transactional sense — Supabase JS
 * doesn't expose `BEGIN`/`COMMIT` over PostgREST. In practice the
 * delete + insert pair runs back-to-back from the service-role
 * client; the worst case under a network blip is the property
 * temporarily showing no amenities until the next save. Acceptable
 * for an admin-only mutation.
 *
 * Returns the new set of amenity IDs on success (for the caller to
 * echo back to the client), or `null` on failure.
 */
export async function setPropertyAmenities(
  propertyId: string,
  amenityIds: number[],
): Promise<number[] | null> {
  try {
    const client = getSupabaseAdminClient();

    const { error: delErr } = await client
      .from('property_amenities')
      .delete()
      .eq('property_id', propertyId);
    if (delErr) {
      console.warn('[setPropertyAmenities] delete failed:', delErr.message);
      return null;
    }

    if (amenityIds.length === 0) {
      return [];
    }

    const rows = amenityIds.map((amenity_id) => ({ property_id: propertyId, amenity_id }));
    const { error: insErr } = await client.from('property_amenities').insert(rows);
    if (insErr) {
      console.warn('[setPropertyAmenities] insert failed:', insErr.message);
      return null;
    }

    return amenityIds;
  } catch (err) {
    console.warn(
      '[setPropertyAmenities] unexpected failure:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
