import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Admin-side reads for the Leads Journal (PR 3.6).
 *
 * Uses the service-role client so the admin can see every lead row,
 * including ones whose IP/PII columns the anon role would never see
 * anyway (no public reads on this table). The page itself is gated to
 * an active admin at the route layer.
 *
 * Today's MVP surface:
 *   - `listLeads(filters)` — paginated chronological timeline with
 *     filters by property / source / inquiry_type / contacted state.
 *   - `getLeadById(id)` — for the PATCH endpoint's audit `before` snap.
 *   - `getLeadsDistinctProperties()` — distinct (property_id, slug,
 *     title) tuples for the filter-bar dropdown.
 *
 * Bilingual PDF export ships in a follow-up PR — the master-plan note
 * about RTL Arabic shaping in @react-pdf/renderer needs separate
 * spike work (custom font registration + IBM Plex Sans Arabic),
 * which is out of scope for this PR.
 */

export const LEAD_SOURCES = ['whatsapp', 'contact_form', 'call_click'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_INQUIRY_TYPES = ['general', 'maintenance'] as const;
export type LeadInquiryType = (typeof LEAD_INQUIRY_TYPES)[number];

export const LEAD_CONTACTED_FILTERS = ['contacted', 'pending'] as const;
export type LeadContactedFilter = (typeof LEAD_CONTACTED_FILTERS)[number];

export const ADMIN_LEADS_PAGE_SIZE = 25;
export const ADMIN_LEADS_MAX_PAGE = 50;

export interface AdminLeadFilters {
  /** Filter to a single property. UUID or empty. */
  propertyId?: string;
  source?: LeadSource;
  inquiryType?: LeadInquiryType;
  /** Contacted-state filter — only one OR the other applies. */
  contacted?: LeadContactedFilter;
  page: number;
}

export interface AdminLeadRow {
  id: string;
  property_id: string | null;
  property_slug: string | null;
  property_title_ar: string | null;
  property_title_en: string | null;
  source: LeadSource;
  inquiry_type: LeadInquiryType;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  locale: 'ar' | 'en';
  contacted_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface AdminLeadsPage {
  items: AdminLeadRow[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminLeadPropertyOption {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
}

/**
 * Parse the URL search params into an `AdminLeadFilters` object. Same
 * defensive contract as `parseAdminPropertyFilters` — unknown values
 * collapse to undefined so a tampered URL never reaches the Supabase
 * query unsanitised.
 */
export function parseAdminLeadFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminLeadFilters {
  const oneValue = (key: string): string | undefined => {
    const value = searchParams[key];
    if (Array.isArray(value)) return value[0];
    return value;
  };
  const propertyId = oneValue('propertyId');
  const source = oneValue('source');
  const inquiryType = oneValue('inquiryType');
  const contacted = oneValue('contacted');
  const page = Number.parseInt(oneValue('page') ?? '1', 10);

  return {
    propertyId: typeof propertyId === 'string' && propertyId.length > 0 ? propertyId : undefined,
    source: LEAD_SOURCES.includes(source as LeadSource) ? (source as LeadSource) : undefined,
    inquiryType: LEAD_INQUIRY_TYPES.includes(inquiryType as LeadInquiryType)
      ? (inquiryType as LeadInquiryType)
      : undefined,
    contacted: LEAD_CONTACTED_FILTERS.includes(contacted as LeadContactedFilter)
      ? (contacted as LeadContactedFilter)
      : undefined,
    page: Number.isFinite(page) && page >= 1 && page <= ADMIN_LEADS_MAX_PAGE ? page : 1,
  };
}

/**
 * Serialise filters into URLSearchParams. Used by the FilterBar's
 * `Clear` link and by Pagination when building next/prev hrefs so the
 * current filter set is preserved across page hops.
 */
export function serializeAdminLeadFilters(filters: AdminLeadFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.propertyId) params.set('propertyId', filters.propertyId);
  if (filters.source) params.set('source', filters.source);
  if (filters.inquiryType) params.set('inquiryType', filters.inquiryType);
  if (filters.contacted) params.set('contacted', filters.contacted);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

/**
 * Hard cap on rows returned by `listAllLeadsForExport`. Bounded to keep
 * the CSV export route's response a single Vercel function turn — at
 * 10k rows the body is ~2 MB which streams cleanly. If a real
 * deployment ever needs more, paginated streaming or a job-queue
 * fan-out is the next step.
 */
export const ADMIN_LEADS_EXPORT_MAX_ROWS = 10000;

/**
 * Read every lead matching `filters` (no pagination), capped at
 * `ADMIN_LEADS_EXPORT_MAX_ROWS`. Used by the CSV export route. Returns
 * an empty array on any Supabase failure so the caller can emit an
 * empty file rather than 500ing the export.
 */
export async function listAllLeadsForExport(
  filters: Omit<AdminLeadFilters, 'page'>,
): Promise<AdminLeadRow[]> {
  try {
    const client = getSupabaseAdminClient();
    let q = client
      .from('leads')
      .select(
        `
        id, property_id, source, inquiry_type, name, phone, email, message,
        locale, contacted_at, notes, created_at,
        properties ( slug, title_ar, title_en )
      `,
      )
      .order('created_at', { ascending: false })
      .range(0, ADMIN_LEADS_EXPORT_MAX_ROWS - 1)
      .abortSignal(AbortSignal.timeout(5000));

    if (filters.propertyId) q = q.eq('property_id', filters.propertyId);
    if (filters.source) q = q.eq('source', filters.source);
    if (filters.inquiryType) q = q.eq('inquiry_type', filters.inquiryType);
    if (filters.contacted === 'contacted') q = q.not('contacted_at', 'is', null);
    if (filters.contacted === 'pending') q = q.is('contacted_at', null);

    const { data, error } = await q;
    if (error) {
      console.warn('[listAllLeadsForExport] supabase returned error:', error.message);
      return [];
    }

    type Row = {
      id: string;
      property_id: string | null;
      source: LeadSource;
      inquiry_type: LeadInquiryType;
      name: string | null;
      phone: string | null;
      email: string | null;
      message: string | null;
      locale: 'ar' | 'en';
      contacted_at: string | null;
      notes: string | null;
      created_at: string;
      properties: { slug: string; title_ar: string; title_en: string } | null;
    };
    const rows = (data ?? []) as unknown as Row[];
    return rows.map((r) => ({
      id: r.id,
      property_id: r.property_id,
      property_slug: r.properties?.slug ?? null,
      property_title_ar: r.properties?.title_ar ?? null,
      property_title_en: r.properties?.title_en ?? null,
      source: r.source,
      inquiry_type: r.inquiry_type,
      name: r.name,
      phone: r.phone,
      email: r.email,
      message: r.message,
      locale: r.locale,
      contacted_at: r.contacted_at,
      notes: r.notes,
      created_at: r.created_at,
    }));
  } catch (err) {
    console.warn(
      '[listAllLeadsForExport] unexpected failure:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function listLeads(filters: AdminLeadFilters): Promise<AdminLeadsPage> {
  try {
    const client = getSupabaseAdminClient();
    const from = (filters.page - 1) * ADMIN_LEADS_PAGE_SIZE;
    const to = from + ADMIN_LEADS_PAGE_SIZE - 1;

    let q = client
      .from('leads')
      .select(
        `
        id, property_id, source, inquiry_type, name, phone, email, message,
        locale, contacted_at, notes, created_at,
        properties ( slug, title_ar, title_en )
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to)
      .abortSignal(AbortSignal.timeout(3000));

    if (filters.propertyId) q = q.eq('property_id', filters.propertyId);
    if (filters.source) q = q.eq('source', filters.source);
    if (filters.inquiryType) q = q.eq('inquiry_type', filters.inquiryType);
    if (filters.contacted === 'contacted') q = q.not('contacted_at', 'is', null);
    if (filters.contacted === 'pending') q = q.is('contacted_at', null);

    const { data, count, error } = await q;
    if (error) {
      console.warn('[listLeads] supabase returned error:', error.message);
      return { items: [], total: 0, page: filters.page, totalPages: 0 };
    }

    type Row = {
      id: string;
      property_id: string | null;
      source: LeadSource;
      inquiry_type: LeadInquiryType;
      name: string | null;
      phone: string | null;
      email: string | null;
      message: string | null;
      locale: 'ar' | 'en';
      contacted_at: string | null;
      notes: string | null;
      created_at: string;
      properties: { slug: string; title_ar: string; title_en: string } | null;
    };
    const rows = (data ?? []) as unknown as Row[];

    const items: AdminLeadRow[] = rows.map((r) => ({
      id: r.id,
      property_id: r.property_id,
      property_slug: r.properties?.slug ?? null,
      property_title_ar: r.properties?.title_ar ?? null,
      property_title_en: r.properties?.title_en ?? null,
      source: r.source,
      inquiry_type: r.inquiry_type,
      name: r.name,
      phone: r.phone,
      email: r.email,
      message: r.message,
      locale: r.locale,
      contacted_at: r.contacted_at,
      notes: r.notes,
      created_at: r.created_at,
    }));

    const total = count ?? 0;
    return {
      items,
      total,
      page: filters.page,
      totalPages: Math.max(1, Math.ceil(total / ADMIN_LEADS_PAGE_SIZE)),
    };
  } catch (err) {
    console.warn('[listLeads] unexpected failure:', err instanceof Error ? err.message : err);
    return { items: [], total: 0, page: filters.page, totalPages: 0 };
  }
}

/**
 * Distinct properties referenced by at least one lead. The filter-bar
 * dropdown only shows projects that actually have leads against them
 * so the list stays manageable.
 */
export async function getLeadsDistinctProperties(): Promise<AdminLeadPropertyOption[]> {
  try {
    const client = getSupabaseAdminClient();
    // Two queries vs. a JOIN with DISTINCT: PostgREST's distinct
    // semantics are awkward, and the leads table is small enough that
    // pulling property_id and resolving titles client-side is fine.
    const { data, error } = await client
      .from('leads')
      .select('property_id')
      .not('property_id', 'is', null)
      .abortSignal(AbortSignal.timeout(2000));
    if (error) {
      console.warn('[getLeadsDistinctProperties] supabase returned error:', error.message);
      return [];
    }
    const ids = Array.from(
      new Set(((data ?? []) as { property_id: string | null }[]).map((r) => r.property_id)),
    ).filter((id): id is string => id !== null);
    if (ids.length === 0) return [];

    const { data: props, error: propsErr } = await client
      .from('properties')
      .select('id, slug, title_ar, title_en')
      .in('id', ids)
      .abortSignal(AbortSignal.timeout(2000));
    if (propsErr) {
      console.warn('[getLeadsDistinctProperties] properties lookup failed:', propsErr.message);
      return [];
    }
    return ((props ?? []) as AdminLeadPropertyOption[])
      .slice()
      .sort((a, b) => a.title_en.localeCompare(b.title_en));
  } catch (err) {
    console.warn(
      '[getLeadsDistinctProperties] unexpected failure:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function getLeadById(id: string): Promise<AdminLeadRow | null> {
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from('leads')
      .select(
        `
        id, property_id, source, inquiry_type, name, phone, email, message,
        locale, contacted_at, notes, created_at,
        properties ( slug, title_ar, title_en )
      `,
      )
      .eq('id', id)
      .abortSignal(AbortSignal.timeout(2000))
      .maybeSingle();
    if (error) {
      console.warn('[getLeadById] supabase returned error:', error.message);
      return null;
    }
    if (!data) return null;
    type Row = {
      id: string;
      property_id: string | null;
      source: LeadSource;
      inquiry_type: LeadInquiryType;
      name: string | null;
      phone: string | null;
      email: string | null;
      message: string | null;
      locale: 'ar' | 'en';
      contacted_at: string | null;
      notes: string | null;
      created_at: string;
      properties: { slug: string; title_ar: string; title_en: string } | null;
    };
    const row = data as unknown as Row;
    return {
      id: row.id,
      property_id: row.property_id,
      property_slug: row.properties?.slug ?? null,
      property_title_ar: row.properties?.title_ar ?? null,
      property_title_en: row.properties?.title_en ?? null,
      source: row.source,
      inquiry_type: row.inquiry_type,
      name: row.name,
      phone: row.phone,
      email: row.email,
      message: row.message,
      locale: row.locale,
      contacted_at: row.contacted_at,
      notes: row.notes,
      created_at: row.created_at,
    };
  } catch (err) {
    console.warn('[getLeadById] unexpected failure:', err instanceof Error ? err.message : err);
    return null;
  }
}
