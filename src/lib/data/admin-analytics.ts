import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

import { LEAD_SOURCES, type LeadSource } from './admin-leads';

/**
 * Server-only readers for the admin Strategic Analytics dashboard
 * at `/<locale>/admin/analytics`. Every reader is bounded, returns
 * a typed empty shape on failure, and uses the service-role client
 * (analytics needs to count rows admins can't otherwise see, e.g.
 * leads on archived properties).
 *
 * **No `page_views_daily` rollup dependency.** The dashboard reads
 * raw `leads`, `whatsapp_clicks`, and `properties` directly. At
 * Al Haual's volume those queries are sub-millisecond on the
 * existing indexes. The original master-plan plan to roll
 * `page_views` into materialized views is deferred until traffic
 * meaningfully grows — see the Phase 4 analytics spec.
 *
 * Date window is hard-coded to **last 30 days** so the page is a
 * single fixed-shape query set. Configurable windows can land in
 * a follow-up.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYTICS_WINDOW_DAYS = 30;
const ANALYTICS_QUERY_TIMEOUT_MS = 4000;

/**
 * Hard cap on rows scanned by the property + city + per-day
 * aggregations. Keeps a runaway query (or someone seeding millions
 * of test leads) from blowing the function-timeout budget. At
 * Al Haual's expected scale a 30-day window contains at most a few
 * hundred leads, well inside the cap.
 */
const ANALYTICS_MAX_SCAN_ROWS = 50_000;

export interface KpiSnapshot {
  leadsLast30Days: number;
  whatsappClicksLast30Days: number;
  publishedProperties: number;
  topPropertyByLeads: {
    id: string;
    titleAr: string;
    titleEn: string;
    leadCount: number;
  } | null;
}

export interface LeadsPerDayPoint {
  /** ISO `YYYY-MM-DD` in UTC. */
  date: string;
  leadCount: number;
}

export interface LeadsBySourcePoint {
  source: LeadSource;
  leadCount: number;
}

export interface LeadsByCityPoint {
  city: string;
  leadCount: number;
}

/**
 * Compute the ISO string for "30 days ago, midnight UTC" — the
 * inclusive lower bound for every analytics query. Centralised so
 * unit tests can validate the window math without re-implementing
 * the date arithmetic.
 */
export function getAnalyticsWindowStart(now: Date = new Date()): Date {
  const start = new Date(now.getTime() - ANALYTICS_WINDOW_DAYS * DAY_MS);
  // Truncate to UTC midnight so the day-bucket aggregation lines up
  // with the zero-fill grid in `getLeadsPerDay`.
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

const emptyKpiSnapshot: KpiSnapshot = {
  leadsLast30Days: 0,
  whatsappClicksLast30Days: 0,
  publishedProperties: 0,
  topPropertyByLeads: null,
};

/**
 * Read the 4 KPI numbers in a single `Promise.all` fan-out. Each
 * sub-query is independent; failures degrade gracefully to zero
 * (so a transient Supabase blip on one column doesn't blank the
 * whole dashboard).
 */
export async function getKpiSnapshot(now: Date = new Date()): Promise<KpiSnapshot> {
  try {
    const client = getSupabaseAdminClient();
    const windowStart = getAnalyticsWindowStart(now).toISOString();

    const [leadsRes, clicksRes, publishedRes, topRes] = await Promise.all([
      client
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', windowStart)
        .abortSignal(AbortSignal.timeout(ANALYTICS_QUERY_TIMEOUT_MS)),
      client
        .from('whatsapp_clicks')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', windowStart)
        .abortSignal(AbortSignal.timeout(ANALYTICS_QUERY_TIMEOUT_MS)),
      // "Published" in the dashboard = "live in the catalog" = any
      // status except `draft`, and not soft-deleted. The schema enum
      // is `draft | available | starting_soon | reserved | sold`;
      // everything except `draft` is visible on the public catalog.
      client
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'draft')
        .is('deleted_at', null)
        .abortSignal(AbortSignal.timeout(ANALYTICS_QUERY_TIMEOUT_MS)),
      getTopPropertyByLeads(client, windowStart),
    ]);

    return {
      leadsLast30Days: leadsRes.count ?? 0,
      whatsappClicksLast30Days: clicksRes.count ?? 0,
      publishedProperties: publishedRes.count ?? 0,
      topPropertyByLeads: topRes,
    };
  } catch (err) {
    console.warn('[getKpiSnapshot] unexpected failure:', err instanceof Error ? err.message : err);
    return emptyKpiSnapshot;
  }
}

async function getTopPropertyByLeads(
  client: ReturnType<typeof getSupabaseAdminClient>,
  windowStart: string,
): Promise<KpiSnapshot['topPropertyByLeads']> {
  const { data, error } = await client
    .from('leads')
    .select('property_id')
    .gte('created_at', windowStart)
    .not('property_id', 'is', null)
    .limit(ANALYTICS_MAX_SCAN_ROWS)
    .abortSignal(AbortSignal.timeout(ANALYTICS_QUERY_TIMEOUT_MS));
  if (error) {
    console.warn('[getTopPropertyByLeads] leads scan error:', error.message);
    return null;
  }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row as { property_id: string | null }).property_id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let topId: string | null = null;
  let topCount = 0;
  for (const [id, n] of counts.entries()) {
    if (n > topCount) {
      topId = id;
      topCount = n;
    }
  }
  if (!topId) return null;

  const { data: prop, error: propErr } = await client
    .from('properties')
    .select('id, title_ar, title_en')
    .eq('id', topId)
    .abortSignal(AbortSignal.timeout(ANALYTICS_QUERY_TIMEOUT_MS))
    .maybeSingle();
  if (propErr || !prop) {
    console.warn('[getTopPropertyByLeads] property fetch error:', propErr?.message ?? 'not found');
    return null;
  }
  const row = prop as { id: string; title_ar: string; title_en: string };
  return {
    id: row.id,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    leadCount: topCount,
  };
}

/**
 * Return exactly 30 points (today through 29 days ago, UTC),
 * zero-filled so the line chart renders a continuous axis even
 * when most days have no leads. The aggregation runs in JS — at
 * Al Haual's volume the row scan stays small. A pg_cron
 * materialized view would beat this at 100k+ leads/day; we'll
 * cross that bridge if traffic ever justifies it.
 */
export async function getLeadsPerDay(now: Date = new Date()): Promise<LeadsPerDayPoint[]> {
  const empty: LeadsPerDayPoint[] = buildZeroFilledDays(now);
  try {
    const client = getSupabaseAdminClient();
    const windowStart = getAnalyticsWindowStart(now).toISOString();
    const { data, error } = await client
      .from('leads')
      .select('created_at')
      .gte('created_at', windowStart)
      .limit(ANALYTICS_MAX_SCAN_ROWS)
      .abortSignal(AbortSignal.timeout(ANALYTICS_QUERY_TIMEOUT_MS));
    if (error) {
      console.warn('[getLeadsPerDay] supabase error:', error.message);
      return empty;
    }
    const byDate = new Map<string, number>();
    for (const row of data ?? []) {
      const iso = (row as { created_at: string }).created_at;
      const key = iso.slice(0, 10); // YYYY-MM-DD
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    }
    return empty.map((p) => ({ date: p.date, leadCount: byDate.get(p.date) ?? 0 }));
  } catch (err) {
    console.warn('[getLeadsPerDay] unexpected failure:', err instanceof Error ? err.message : err);
    return empty;
  }
}

function buildZeroFilledDays(now: Date): LeadsPerDayPoint[] {
  const out: LeadsPerDayPoint[] = [];
  const base = new Date(now);
  base.setUTCHours(0, 0, 0, 0);
  for (let i = ANALYTICS_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * DAY_MS);
    out.push({ date: d.toISOString().slice(0, 10), leadCount: 0 });
  }
  return out;
}

/**
 * Always returns all 3 sources in the canonical order
 * (`whatsapp`, `contact_form`, `call_click`) so the bar chart
 * legend is stable even when one source has zero leads.
 */
export async function getLeadsBySource(now: Date = new Date()): Promise<LeadsBySourcePoint[]> {
  const empty: LeadsBySourcePoint[] = LEAD_SOURCES.map((source) => ({ source, leadCount: 0 }));
  try {
    const client = getSupabaseAdminClient();
    const windowStart = getAnalyticsWindowStart(now).toISOString();
    const { data, error } = await client
      .from('leads')
      .select('source')
      .gte('created_at', windowStart)
      .limit(ANALYTICS_MAX_SCAN_ROWS)
      .abortSignal(AbortSignal.timeout(ANALYTICS_QUERY_TIMEOUT_MS));
    if (error) {
      console.warn('[getLeadsBySource] supabase error:', error.message);
      return empty;
    }
    const counts: Record<LeadSource, number> = {
      whatsapp: 0,
      contact_form: 0,
      call_click: 0,
    };
    for (const row of data ?? []) {
      const src = (row as { source: LeadSource }).source;
      if (src in counts) counts[src]++;
    }
    return LEAD_SOURCES.map((source) => ({ source, leadCount: counts[source] }));
  } catch (err) {
    console.warn(
      '[getLeadsBySource] unexpected failure:',
      err instanceof Error ? err.message : err,
    );
    return empty;
  }
}

/**
 * Top 10 cities by lead count over the analytics window. Cities
 * with zero leads are obviously absent. Ordering ties broken by
 * city name (alphabetical) for deterministic test output.
 */
export async function getTopCities(now: Date = new Date()): Promise<LeadsByCityPoint[]> {
  try {
    const client = getSupabaseAdminClient();
    const windowStart = getAnalyticsWindowStart(now).toISOString();
    const { data, error } = await client
      .from('leads')
      .select('city')
      .gte('created_at', windowStart)
      .not('city', 'is', null)
      .limit(ANALYTICS_MAX_SCAN_ROWS)
      .abortSignal(AbortSignal.timeout(ANALYTICS_QUERY_TIMEOUT_MS));
    if (error) {
      console.warn('[getTopCities] supabase error:', error.message);
      return [];
    }
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const city = (row as { city: string | null }).city;
      if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .slice(0, 10)
      .map(([city, leadCount]) => ({ city, leadCount }));
  } catch (err) {
    console.warn('[getTopCities] unexpected failure:', err instanceof Error ? err.message : err);
    return [];
  }
}
