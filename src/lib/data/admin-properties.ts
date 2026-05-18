import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  ADMIN_PROPERTY_STATUSES,
  ADMIN_PROPERTY_TYPES,
  type AdminPropertyStatus,
  type AdminPropertyType,
} from '@/lib/validators/property';

/**
 * Admin-side property reads. Uses the service-role client because the
 * admin Listing Management screen needs to show drafts, archived rows,
 * and rows whose RLS would otherwise hide them from the anon key.
 *
 * Public catalog reads (`src/lib/data/properties.ts`) stay on the anon
 * client + RLS — different audience, different policy.
 *
 * The enum constants moved into `lib/validators/property.ts` (Phase 3.4)
 * so client-side form components can import them without dragging the
 * `server-only` boundary into the browser bundle.
 */

export {
  ADMIN_PROPERTY_TYPES,
  ADMIN_PROPERTY_STATUSES,
  type AdminPropertyType,
  type AdminPropertyStatus,
};

export const ADMIN_PROPERTIES_PAGE_SIZE = 20;
export const ADMIN_PROPERTIES_MAX_PAGE = 50;

export interface AdminPropertyFilters {
  /** Free-text search; matched against title_ar + title_en + slug + city. */
  query?: string;
  type?: AdminPropertyType;
  status?: AdminPropertyStatus;
  city?: string;
  featured?: boolean;
  /** When true, includes soft-deleted rows in the result. Default false. */
  includeArchived?: boolean;
  page: number;
}

export interface AdminPropertyRow {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  type: AdminPropertyType;
  status: AdminPropertyStatus;
  price_sar: number;
  city: string;
  district: string | null;
  featured: boolean;
  // Note: `view_count_total` + `hero_image_id` were dropped in
  // migration 0003_review_fixes.sql (view count derived from
  // page_views_daily, hero resolved via property_images.is_hero).
  // The listings table doesn't need either for the read-only view.
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AdminPropertiesPage {
  rows: AdminPropertyRow[];
  total: number;
  totalPages: number;
}

/**
 * Server-side filtered + paginated query for the admin listings table.
 *
 * On Supabase failure (e.g. CI build with a placeholder URL, or a
 * transient network blip), returns an empty page rather than throwing.
 * The page renders an empty state and the strict reviewer can still
 * inspect chrome / filters; production gets real data on first
 * authenticated request.
 *
 * `count: 'exact'` is intentional — the admin user cares about the
 * actual number of rows behind the filter; we render "Showing N of M
 * properties" in the topbar.
 */
export async function listAdminProperties(
  filters: AdminPropertyFilters,
): Promise<AdminPropertiesPage> {
  const empty: AdminPropertiesPage = { rows: [], total: 0, totalPages: 0 };
  try {
    const client = getSupabaseAdminClient();
    const page = Math.max(1, Math.min(ADMIN_PROPERTIES_MAX_PAGE, filters.page));
    const from = (page - 1) * ADMIN_PROPERTIES_PAGE_SIZE;
    const to = from + ADMIN_PROPERTIES_PAGE_SIZE - 1;

    let query = client
      .from('properties')
      .select(
        'id, slug, title_ar, title_en, type, status, price_sar, city, district, featured, created_at, updated_at, deleted_at',
        { count: 'exact' },
      )
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (!filters.includeArchived) {
      query = query.is('deleted_at', null);
    }
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.city) query = query.eq('city', filters.city);
    if (filters.featured !== undefined) query = query.eq('featured', filters.featured);
    if (filters.query) {
      const q = filters.query.trim().slice(0, 100);
      if (q) {
        const escaped = q.replace(/[%_]/g, (m) => `\\${m}`);
        const pattern = `%${escaped}%`;
        // OR-match across the bilingual title, slug, and city.
        query = query.or(
          `title_ar.ilike.${pattern},title_en.ilike.${pattern},slug.ilike.${pattern},city.ilike.${pattern}`,
        );
      }
    }

    // 2s budget: production Supabase responds in <500ms; this cap stops
    // CI's placeholder URL (and any prod-side network blip) from blocking
    // the RSC render long enough to make `router.push` wait past the
    // 5s `toHaveURL` poll. On timeout the catch block returns the empty
    // page — same UX as a real Supabase error.
    const { data, count, error } = await query.abortSignal(AbortSignal.timeout(2000));
    if (error) {
      console.warn('[listAdminProperties] supabase returned error:', error.message);
      return empty;
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / ADMIN_PROPERTIES_PAGE_SIZE));
    return {
      rows: (data ?? []) as AdminPropertyRow[],
      total,
      totalPages,
    };
  } catch (err) {
    console.warn(
      '[listAdminProperties] unexpected failure:',
      err instanceof Error ? err.message : err,
    );
    return empty;
  }
}

/**
 * Load a single property by id, for the admin Edit form. Returns null on
 * Supabase failure or when the row doesn't exist. Includes ALL columns
 * the form needs to round-trip (creating PR 3.4 keeps this narrow; the
 * wizard's images + amenities steps in later PRs will extend the select).
 */
export async function getAdminPropertyById(id: string): Promise<AdminPropertyEditRow | null> {
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from('properties')
      .select(
        'id, slug, title_ar, title_en, description_ar, description_en, type, status, price_sar, price_negotiable, area_sqm, bedrooms, bathrooms, city, district, plot_number, street_width_m, facade, lat, lng, google_maps_url, featured, deleted_at',
      )
      .eq('id', id)
      .abortSignal(AbortSignal.timeout(2000))
      .maybeSingle();
    if (error) {
      console.warn('[getAdminPropertyById] supabase returned error:', error.message);
      return null;
    }
    return (data ?? null) as AdminPropertyEditRow | null;
  } catch (err) {
    console.warn(
      '[getAdminPropertyById] unexpected failure:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export interface AdminPropertyEditRow {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  type: AdminPropertyType;
  status: AdminPropertyStatus;
  price_sar: number;
  price_negotiable: boolean;
  area_sqm: number;
  bedrooms: number;
  bathrooms: number;
  city: string;
  district: string | null;
  plot_number: string | null;
  street_width_m: number | null;
  facade: string | null;
  lat: number | null;
  lng: number | null;
  google_maps_url: string | null;
  featured: boolean;
  deleted_at: string | null;
}

/**
 * Distinct cities for the admin filter dropdown. Includes cities tied to
 * drafts + archived rows (since the admin user can filter by them).
 */
export async function getAdminDistinctCities(): Promise<string[]> {
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from('properties')
      .select('city')
      .order('city', { ascending: true })
      .abortSignal(AbortSignal.timeout(2000));
    if (error) {
      console.warn('[getAdminDistinctCities] supabase returned error:', error.message);
      return [];
    }
    const cities = new Set<string>();
    for (const row of data ?? []) {
      const city = (row as { city: string | null }).city;
      if (city) cities.add(city);
    }
    return Array.from(cities);
  } catch (err) {
    console.warn(
      '[getAdminDistinctCities] unexpected failure:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Parse + sanitise the admin properties filter set from URL searchParams.
 * Unknown values fall back to undefined so the page falls back to
 * "show everything" rather than throwing on a typo-ed URL.
 */
export function parseAdminPropertyFilters(
  raw: Record<string, string | string[] | undefined>,
): AdminPropertyFilters {
  function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  const type = first(raw.type);
  const status = first(raw.status);
  const featuredRaw = first(raw.featured);
  const pageRaw = first(raw.page);
  const includeArchivedRaw = first(raw.archived);

  const page = Number.parseInt(pageRaw ?? '1', 10);

  return {
    query: first(raw.q)?.trim() || undefined,
    type:
      type && (ADMIN_PROPERTY_TYPES as readonly string[]).includes(type)
        ? (type as AdminPropertyType)
        : undefined,
    status:
      status && (ADMIN_PROPERTY_STATUSES as readonly string[]).includes(status)
        ? (status as AdminPropertyStatus)
        : undefined,
    city: first(raw.city)?.trim() || undefined,
    featured: featuredRaw === 'true' ? true : featuredRaw === 'false' ? false : undefined,
    includeArchived: includeArchivedRaw === 'true',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/**
 * Serialise the filter set back into a URL query string (no leading `?`).
 * Used by pagination links to preserve the active filter set across
 * page changes.
 */
export function serializeAdminPropertyFilters(filters: AdminPropertyFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.city) params.set('city', filters.city);
  if (filters.featured !== undefined) params.set('featured', String(filters.featured));
  if (filters.includeArchived) params.set('archived', 'true');
  if (filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}
