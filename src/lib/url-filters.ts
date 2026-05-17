/**
 * URL → typed catalog filters (and back).
 *
 * The catalog at `/<locale>/properties` is filter-by-URL: every filter
 * lives in a searchParam so the URL is shareable, the back button
 * works, and there is no client-side fetch logic to maintain. These
 * helpers are pure (no React, no Next.js dependencies) so they can be
 * imported from the route's server component AND unit-tested in isolation.
 *
 * Caps:
 *   - search query is hard-capped at 100 chars (matches the free-tier
 *     hardening rule in docs/PHASE_1_SUMMARY.md)
 *   - page is clamped to [1, MAX_PAGE]
 *   - page size is FIXED at PAGE_SIZE — the URL cannot oversize a query
 */
export const PROPERTY_TYPES = ['villa', 'duplex', 'apartment', 'investment'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PAGE_SIZE = 12;
export const MAX_PAGE = 50;
export const MAX_QUERY_LENGTH = 100;

export type CatalogFilters = {
  type: PropertyType | null;
  city: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  query: string | null;
  page: number;
};

const isPropertyType = (value: string): value is PropertyType =>
  (PROPERTY_TYPES as readonly string[]).includes(value);

/**
 * Parse a Next.js `searchParams` object into a clean, validated filter
 * shape. Out-of-range / malformed values silently degrade to `null` —
 * the catalog stays usable even on a hand-typed URL.
 */
export function parseCatalogFilters(
  searchParams: Record<string, string | string[] | undefined>,
): CatalogFilters {
  const pick = (key: string): string | null => {
    const raw = searchParams[key];
    if (raw === undefined) return null;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw;
  };

  const typeRaw = pick('type');
  const type = typeRaw && isPropertyType(typeRaw) ? typeRaw : null;

  const cityRaw = pick('city');
  const city = cityRaw && cityRaw.length > 0 && cityRaw.length <= 64 ? cityRaw : null;

  const minPrice = parsePositiveInt(pick('minPrice'));
  const maxPrice = parsePositiveInt(pick('maxPrice'));

  const queryRaw = pick('q');
  const query = queryRaw ? queryRaw.trim().slice(0, MAX_QUERY_LENGTH) || null : null;

  const pageRaw = parsePositiveInt(pick('page')) ?? 1;
  const page = Math.min(Math.max(pageRaw, 1), MAX_PAGE);

  return { type, city, minPrice, maxPrice, query, page };
}

function parsePositiveInt(value: string | null): number | null {
  if (value === null) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Serialise filters back into a URL search string. Used by:
 *   - the filter form's hidden inputs (preserving non-edited fields)
 *   - pagination links
 *   - the "clear filter" actions
 *
 * Returns a string like `type=villa&city=Riyadh&page=2`. Empty string
 * when all filters are unset (`/<locale>/properties` is the canonical
 * default URL). Excludes `page=1` because the catalog defaults to page 1.
 */
export function serializeCatalogFilters(
  filters: Partial<CatalogFilters>,
  options: { includeDefaults?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.city) params.set('city', filters.city);
  if (filters.minPrice != null && filters.minPrice > 0)
    params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice != null && filters.maxPrice > 0)
    params.set('maxPrice', String(filters.maxPrice));
  if (filters.query) params.set('q', filters.query);
  if (filters.page != null && filters.page > 1) params.set('page', String(filters.page));
  if (options.includeDefaults && filters.page === 1) params.set('page', '1');
  return params.toString();
}

/**
 * True if any filter (other than the page number) is set. Used to
 * decide whether the empty state shows "no properties yet" or
 * "no matches for your filters, try clearing them".
 */
export function hasActiveFilters(filters: CatalogFilters): boolean {
  return Boolean(
    filters.type || filters.city || filters.minPrice || filters.maxPrice || filters.query,
  );
}
