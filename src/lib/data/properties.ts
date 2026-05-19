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
    // Belt-and-suspenders filters on top of RLS: when an admin is logged
    // in, `createSupabaseServerClient` reads their Supabase Auth session
    // cookie, the "admins read all properties" RLS policy fires, and the
    // anon-only `(status <> 'draft' AND deleted_at IS NULL)` policy is
    // bypassed. Explicit filters here keep the public surfaces honest
    // regardless of who's signed in.
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
      .neq('status', 'draft')
      .is('deleted_at', null)
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

    // Belt-and-suspenders filters: RLS hides drafts + archived rows from
    // the anon role, but when an admin is logged in the "admins read all"
    // policy fires and the catalog leaks every row. Always filter at the
    // query level so the public surfaces stay honest regardless of who's
    // signed in. The previous version of this query showed archived /
    // draft properties on `/properties` to logged-in admins (cf.
    // 2026-05-19 bug report).
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
      .neq('status', 'draft')
      .is('deleted_at', null)
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
    // Same defence-in-depth as `searchProperties`: filter explicitly so the
    // catalog dropdown doesn't surface cities that only have draft /
    // archived rows when an admin is signed in.
    const { data, error } = await supabase
      .from('properties')
      .select('city')
      .neq('status', 'draft')
      .is('deleted_at', null)
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

/**
 * Full read model for the property detail page. Carries everything the
 * `/[locale]/properties/[slug]` route needs in a single round-trip:
 * core fields, every image (ordered, with hero flag), and the joined
 * amenities (grouped on the client by category).
 */
export type PropertyImage = {
  id: string;
  blob_url: string;
  width: number;
  height: number;
  alt_ar: string;
  alt_en: string;
  position: number;
  is_hero: boolean;
};

export type PropertyAmenity = {
  key: string;
  label_ar: string;
  label_en: string;
  icon: string;
  category: string | null;
};

export type PropertyDetail = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  type: PropertySummary['type'];
  status: PropertySummary['status'];
  price_sar: number;
  price_negotiable: boolean;
  area_sqm: number;
  bedrooms: number;
  bathrooms: number;
  city: string;
  district: string | null;
  plot_number: string | null;
  street_width_m: number | null;
  facade: 'north' | 'south' | 'east' | 'west' | 'corner' | null;
  lat: number | null;
  lng: number | null;
  google_maps_url: string | null;
  created_at: string;
  updated_at: string;
  images: PropertyImage[];
  amenities: PropertyAmenity[];
};

/**
 * Fetch a single live property by URL slug for the detail page.
 *
 * Returns `null` when:
 *   - no row matches (RLS hides drafts and soft-deleted rows from anon)
 *   - Supabase is unreachable (build-time placeholder URL, transient
 *     network error) — the caller renders `notFound()` so a real 404 is
 *     emitted rather than a 200 with empty state (SEO rule from the
 *     plan: missing properties must not poison the index).
 *
 * Images come back ordered by `position` (admin-controllable in Phase 3);
 * the hero is also flagged via `is_hero` so the gallery / OpenGraph
 * generator can prioritise it without a second sort.
 */
export async function getPropertyBySlug(slug: string): Promise<PropertyDetail | null> {
  try {
    const supabase = await createSupabaseServerClient();
    // Same defence-in-depth as `searchProperties`. Without these explicit
    // filters, an admin who navigates to the public detail URL for a
    // draft / archived row sees it (the "admins read all" RLS policy
    // bypasses the anon-only "live properties only" rule).
    const { data, error } = await supabase
      .from('properties')
      .select(
        `
        id, slug, title_ar, title_en, description_ar, description_en,
        type, status, price_sar, price_negotiable, area_sqm,
        bedrooms, bathrooms, city, district, plot_number, street_width_m,
        facade, lat, lng, google_maps_url, created_at, updated_at,
        property_images ( id, blob_url, width, height, alt_ar, alt_en, position, is_hero ),
        property_amenities (
          amenities ( key, label_ar, label_en, icon, category )
        )
      `,
      )
      .eq('slug', slug)
      .neq('status', 'draft')
      .is('deleted_at', null)
      .order('position', { ascending: true, referencedTable: 'property_images' })
      .maybeSingle();

    if (error) {
      // TODO(ux-papercuts): REMOVE diagnostic verbosity once the prod
      // detail-page 404 (2026-05-19) is root-caused. Reduce back to
      // `console.warn('[getPropertyBySlug] supabase returned error:', error.message)`.
      console.warn(
        `[getPropertyBySlug] supabase error for slug="${slug}" code=${error.code ?? 'none'}: ${error.message}`,
      );
      return null;
    }
    if (!data) {
      // TODO(ux-papercuts): REMOVE this warning once the prod 404 is
      // root-caused. The no-row case is normal (stale slugs / draft
      // properties); we only need the log line until we figure out why
      // a published, catalog-visible row is returning null on the
      // detail page in production.
      console.warn(
        `[getPropertyBySlug] no row returned for slug="${slug}" — RLS may have hidden a draft / soft-deleted row, OR the slug is stale.`,
      );
      return null;
    }

    type Row = {
      id: string;
      slug: string;
      title_ar: string;
      title_en: string;
      description_ar: string;
      description_en: string;
      type: PropertyDetail['type'];
      status: PropertyDetail['status'];
      price_sar: number | string;
      price_negotiable: boolean;
      area_sqm: number | string;
      bedrooms: number;
      bathrooms: number;
      city: string;
      district: string | null;
      plot_number: string | null;
      street_width_m: number | null;
      facade: PropertyDetail['facade'];
      lat: number | string | null;
      lng: number | string | null;
      google_maps_url: string | null;
      created_at: string;
      updated_at: string;
      property_images: unknown;
      property_amenities: unknown;
    };
    const row = data as unknown as Row;

    return {
      id: row.id,
      slug: row.slug,
      title_ar: row.title_ar,
      title_en: row.title_en,
      description_ar: row.description_ar,
      description_en: row.description_en,
      type: row.type,
      status: row.status,
      price_sar: Number(row.price_sar),
      price_negotiable: row.price_negotiable,
      area_sqm: Number(row.area_sqm),
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      city: row.city,
      district: row.district ?? null,
      plot_number: row.plot_number ?? null,
      street_width_m: row.street_width_m ?? null,
      facade: row.facade ?? null,
      lat: row.lat == null ? null : Number(row.lat),
      lng: row.lng == null ? null : Number(row.lng),
      google_maps_url: row.google_maps_url ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      images: normaliseImages(row.property_images),
      amenities: normaliseAmenities(row.property_amenities),
    };
  } catch (err) {
    console.warn(
      '[getPropertyBySlug] supabase fetch failed (will 404):',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Slugs of all live properties for `generateStaticParams`. Returns an
 * empty array on failure (build still succeeds — the catalog already
 * tolerates an empty Supabase, and the slug pages will be generated
 * on-demand by ISR once Supabase comes back).
 */
export async function listLivePropertySlugs(): Promise<string[]> {
  try {
    const supabase = await createSupabaseServerClient();
    // Same defence-in-depth — sitemap.xml MUST NOT advertise draft /
    // archived URLs to search engines, regardless of whether an admin
    // happened to be signed in when the sitemap was last rendered.
    const { data, error } = await supabase
      .from('properties')
      .select('slug')
      .neq('status', 'draft')
      .is('deleted_at', null);
    if (error || !data) return [];
    return (data as unknown as Array<{ slug: string }>)
      .map((row) => row.slug)
      .filter((slug): slug is string => typeof slug === 'string' && slug.length > 0);
  } catch {
    return [];
  }
}

function normaliseImages(raw: unknown): PropertyImage[] {
  if (!Array.isArray(raw)) return [];
  const out: PropertyImage[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const r = entry as Record<string, unknown>;
    if (
      typeof r.id !== 'string' ||
      typeof r.blob_url !== 'string' ||
      typeof r.width !== 'number' ||
      typeof r.height !== 'number'
    )
      continue;
    out.push({
      id: r.id,
      blob_url: r.blob_url,
      width: r.width,
      height: r.height,
      alt_ar: typeof r.alt_ar === 'string' ? r.alt_ar : '',
      alt_en: typeof r.alt_en === 'string' ? r.alt_en : '',
      position: typeof r.position === 'number' ? r.position : 0,
      is_hero: r.is_hero === true,
    });
  }
  // Hero first, then by position ascending. PostgREST already sorts by
  // position via the .order() above, but we re-sort defensively so the
  // gallery component never has to think about ordering.
  out.sort((a, b) => {
    if (a.is_hero !== b.is_hero) return a.is_hero ? -1 : 1;
    return a.position - b.position;
  });
  return out;
}

function normaliseAmenities(raw: unknown): PropertyAmenity[] {
  if (!Array.isArray(raw)) return [];
  const out: PropertyAmenity[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const nested = (entry as Record<string, unknown>).amenities;
    if (!nested || typeof nested !== 'object') continue;
    const a = nested as Record<string, unknown>;
    if (typeof a.key !== 'string') continue;
    out.push({
      key: a.key,
      label_ar: typeof a.label_ar === 'string' ? a.label_ar : a.key,
      label_en: typeof a.label_en === 'string' ? a.label_en : a.key,
      icon: typeof a.icon === 'string' ? a.icon : 'check',
      category: typeof a.category === 'string' ? a.category : null,
    });
  }
  return out;
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
