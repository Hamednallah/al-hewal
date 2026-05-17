import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type CatalogFilters, PAGE_SIZE } from '@/lib/url-filters';

/**
 * Read model for a property summary card (catalog + featured carousel).
 * Intentionally narrow — full detail comes from `getPropertyBySlug`.
 */
export type PropertySummary = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  type: 'villa' | 'duplex' | 'apartment' | 'investment';
  status: 'available' | 'starting_soon' | 'reserved' | 'sold';
  price_sar: number;
  area_sqm: number;
  bedrooms: number;
  bathrooms: number;
  city: string;
  district: string | null;
  hero_image: {
    blob_url: string;
    width: number;
    height: number;
    alt_ar: string;
    alt_en: string;
  } | null;
};

/**
 * Featured properties for the home carousel.
 *
 * Returns at most `limit` rows ordered by `featured_order`. Properties
 * whose status is `draft`, `sold`, or that have a non-null `deleted_at`
 * are excluded by the public RLS policy, so the unauthenticated query
 * surfaces only live listings without us having to filter explicitly.
 *
 * Failure mode: if Supabase is unreachable (e.g. CI build with a
 * placeholder URL, or a transient network blip), returns `[]` and logs
 * the error. The home page will render its "no featured projects yet"
 * empty state — production gets real data on first request after the
 * ISR cache fills.
 *
 * Seed is local-only per the project decision; the deployed catalog
 * starts empty until Phase 3 admin uploads real properties. See
 * docs/POST_DEPLOY_CHECKLIST.md.
 */
export async function getFeaturedProperties(limit = 6): Promise<PropertySummary[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('properties')
      .select(
        `
        id, slug, title_ar, title_en, type, status, price_sar, area_sqm,
        bedrooms, bathrooms, city, district,
        property_images!inner ( blob_url, width, height, alt_ar, alt_en, is_hero )
      `,
      )
      .eq('featured', true)
      .eq('property_images.is_hero', true)
      .order('featured_order', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.warn('[getFeaturedProperties] supabase returned error:', error.message);
      return [];
    }
    if (!data) return [];

    // The `Database` placeholder types every row as `unknown`, so
    // supabase-js's generic resolution collapses to `never`. The actual
    // shape is dictated by the SELECT above; assert that locally.
    type FeaturedRow = {
      id: string;
      slug: string;
      title_ar: string;
      title_en: string;
      type: PropertySummary['type'];
      status: PropertySummary['status'];
      price_sar: number | string;
      area_sqm: number | string;
      bedrooms: number;
      bathrooms: number;
      city: string;
      district: string | null;
      property_images: unknown;
    };
    const rows = data as unknown as FeaturedRow[];

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title_ar: row.title_ar,
      title_en: row.title_en,
      type: row.type,
      status: row.status,
      price_sar: Number(row.price_sar),
      area_sqm: Number(row.area_sqm),
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      city: row.city,
      district: row.district ?? null,
      hero_image: pickHeroImage(row.property_images),
    }));
  } catch (err) {
    console.warn(
      '[getFeaturedProperties] supabase fetch failed (empty state will render):',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

type ImageRow = {
  blob_url?: unknown;
  width?: unknown;
  height?: unknown;
  alt_ar?: unknown;
  alt_en?: unknown;
  is_hero?: unknown;
};

/**
 * Catalog search with filters + pagination.
 *
 * Server-rendered into the `/<locale>/properties` page. Returns the
 * matching page of summaries plus the total count so pagination can
 * be rendered without a second round-trip.
 *
 * RLS still gates visibility (`status <> 'draft' and deleted_at is null`)
 * — this query is anon-keyed. The `text-search` filter uses Postgres
 * trigram via the `pg_trgm` index added in migration 0001 (Arabic
 * fallback) plus a `or` on the English title with `ilike`. For a real
 * MVP this is fine; Phase 5 evaluates a dedicated search backend if
 * Arabic relevance proves weak.
 *
 * Failure mode: returns `{ items: [], total: 0 }` and logs a warning on
 * any Supabase error so the catalog renders its empty state instead of
 * crashing the page.
 */
export type SearchResult = {
  items: PropertySummary[];
  total: number;
  page: number;
  totalPages: number;
};

export async function searchProperties(filters: CatalogFilters): Promise<SearchResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const from = (filters.page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from('properties')
      .select(
        `
        id, slug, title_ar, title_en, type, status, price_sar, area_sqm,
        bedrooms, bathrooms, city, district,
        property_images!left ( blob_url, width, height, alt_ar, alt_en, is_hero )
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.type) q = q.eq('type', filters.type);
    if (filters.city) q = q.eq('city', filters.city);
    if (filters.minPrice != null) q = q.gte('price_sar', filters.minPrice);
    if (filters.maxPrice != null) q = q.lte('price_sar', filters.maxPrice);
    if (filters.query) {
      // Match either title_ar or title_en, case-insensitive. URL-quoting
      // protects against operator injection in PostgREST's `or` syntax.
      const safe = filters.query.replace(/[%,)(]/g, '');
      q = q.or(`title_ar.ilike.%${safe}%,title_en.ilike.%${safe}%`);
    }

    const { data, count, error } = await q;
    if (error) {
      console.warn('[searchProperties] supabase returned error:', error.message);
      return { items: [], total: 0, page: filters.page, totalPages: 0 };
    }
    if (!data) return { items: [], total: 0, page: filters.page, totalPages: 0 };

    type Row = {
      id: string;
      slug: string;
      title_ar: string;
      title_en: string;
      type: PropertySummary['type'];
      status: PropertySummary['status'];
      price_sar: number | string;
      area_sqm: number | string;
      bedrooms: number;
      bathrooms: number;
      city: string;
      district: string | null;
      property_images: unknown;
    };
    const rows = data as unknown as Row[];

    const items: PropertySummary[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title_ar: row.title_ar,
      title_en: row.title_en,
      type: row.type,
      status: row.status,
      price_sar: Number(row.price_sar),
      area_sqm: Number(row.area_sqm),
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      city: row.city,
      district: row.district ?? null,
      hero_image: pickHeroImage(row.property_images),
    }));

    const total = count ?? items.length;
    return {
      items,
      total,
      page: filters.page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  } catch (err) {
    console.warn(
      '[searchProperties] supabase fetch failed (empty state will render):',
      err instanceof Error ? err.message : err,
    );
    return { items: [], total: 0, page: filters.page, totalPages: 0 };
  }
}

/**
 * Distinct cities for the catalog's city filter dropdown. Returns an
 * empty list on failure so the dropdown gracefully hides.
 */
export async function listFilterableCities(): Promise<string[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('properties')
      .select('city')
      .order('city', { ascending: true });
    if (error || !data) return [];
    const cities = new Set<string>();
    for (const row of data as unknown as Array<{ city: string }>) {
      if (row.city) cities.add(row.city);
    }
    return Array.from(cities);
  } catch {
    return [];
  }
}

function pickHeroImage(images: unknown): PropertySummary['hero_image'] {
  if (!Array.isArray(images)) return null;
  const hero = images.find((img) => (img as ImageRow)?.is_hero === true) ?? images[0];
  if (!hero) return null;
  const h = hero as ImageRow;
  if (typeof h.blob_url !== 'string' || typeof h.width !== 'number' || typeof h.height !== 'number')
    return null;
  return {
    blob_url: h.blob_url,
    width: h.width,
    height: h.height,
    alt_ar: typeof h.alt_ar === 'string' ? h.alt_ar : '',
    alt_en: typeof h.alt_en === 'string' ? h.alt_en : '',
  };
}
