import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level chainable stub for the Supabase admin client. Each test
// configures the terminal resolver via `setQueryResult`. The chain
// methods (`from`, `select`, `gte`, `eq`, `is`, `not`, `limit`,
// `order`, `abortSignal`, `maybeSingle`) all return `this`. When a
// reader awaits the chain (no terminal method), the chain resolves
// via the thenable behaviour set up below.
type QueryResult = {
  data?: unknown;
  count?: number | null;
  error?: { message: string } | null;
};

let resultQueue: QueryResult[] = [];
let nextSingleResult: QueryResult | null = null;

function setQueryResult(...results: QueryResult[]) {
  resultQueue = results;
}
function setMaybeSingleResult(result: QueryResult) {
  nextSingleResult = result;
}
function popQueryResult(): QueryResult {
  return resultQueue.shift() ?? { data: [], count: 0, error: null };
}

// Each `client.from(...)` call returns a brand-new chain bound to the
// next queued result. That way concurrent awaits inside Promise.all
// don't race against a shared `then`. The chain methods all return
// `this`, so call order on the chain is irrelevant.
function makeChain(bound: QueryResult) {
  const chain: Record<string, unknown> = {};
  for (const k of ['select', 'gte', 'eq', 'neq', 'is', 'not', 'limit', 'order', 'abortSignal']) {
    chain[k] = vi.fn().mockImplementation(() => chain);
  }
  chain.then = vi.fn().mockImplementation((onResolve: (value: QueryResult) => void) => {
    onResolve(bound);
    return Promise.resolve();
  });
  chain.maybeSingle = vi.fn().mockImplementation(() => {
    const out = nextSingleResult ?? bound;
    nextSingleResult = null;
    return Promise.resolve(out);
  });
  return chain;
}

vi.mock('@/lib/supabase/admin', () => {
  const client = {
    from: vi.fn().mockImplementation(() => makeChain(popQueryResult())),
  };
  return { getSupabaseAdminClient: () => client };
});

import {
  getAnalyticsWindowStart,
  getKpiSnapshot,
  getLeadsPerDay,
  getLeadsBySource,
  getTopCities,
} from '@/lib/data/admin-analytics';

const NOW = new Date('2026-05-21T12:00:00.000Z');

beforeEach(() => {
  resultQueue = [];
  nextSingleResult = null;
  vi.clearAllMocks();
});

describe('getAnalyticsWindowStart', () => {
  it('truncates to UTC midnight 30 days before now', () => {
    const start = getAnalyticsWindowStart(NOW);
    expect(start.toISOString()).toBe('2026-04-21T00:00:00.000Z');
  });
});

describe('getKpiSnapshot', () => {
  it('returns zero shape when every query is empty', async () => {
    setQueryResult(
      { count: 0, data: null, error: null }, // leads count
      { count: 0, data: null, error: null }, // whatsapp_clicks count
      { count: 0, data: null, error: null }, // published count
      { data: [], error: null }, // top-property leads scan
    );
    const snap = await getKpiSnapshot(NOW);
    expect(snap).toEqual({
      leadsLast30Days: 0,
      whatsappClicksLast30Days: 0,
      publishedProperties: 0,
      topPropertyByLeads: null,
    });
  });

  it('aggregates KPI counts and resolves the top property', async () => {
    setQueryResult(
      { count: 12, error: null }, // leads
      { count: 30, error: null }, // whatsapp_clicks
      { count: 4, error: null }, // properties
      {
        data: [{ property_id: 'prop-a' }, { property_id: 'prop-a' }, { property_id: 'prop-b' }],
        error: null,
      },
    );
    setMaybeSingleResult({
      data: { id: 'prop-a', title_ar: 'الدانة', title_en: 'Al Dana' },
      error: null,
    });
    const snap = await getKpiSnapshot(NOW);
    expect(snap.leadsLast30Days).toBe(12);
    expect(snap.whatsappClicksLast30Days).toBe(30);
    expect(snap.publishedProperties).toBe(4);
    expect(snap.topPropertyByLeads).toEqual({
      id: 'prop-a',
      titleAr: 'الدانة',
      titleEn: 'Al Dana',
      leadCount: 2,
    });
  });

  it('degrades gracefully on supabase failure', async () => {
    setQueryResult(
      { count: null, error: { message: 'boom' } },
      { count: null, error: { message: 'boom' } },
      { count: null, error: { message: 'boom' } },
      { data: null, error: { message: 'boom' } },
    );
    const snap = await getKpiSnapshot(NOW);
    expect(snap.leadsLast30Days).toBe(0);
    expect(snap.whatsappClicksLast30Days).toBe(0);
    expect(snap.publishedProperties).toBe(0);
    expect(snap.topPropertyByLeads).toBeNull();
  });
});

describe('getLeadsPerDay', () => {
  it('returns exactly 30 zero-filled points when no leads exist', async () => {
    setQueryResult({ data: [], error: null });
    const series = await getLeadsPerDay(NOW);
    expect(series).toHaveLength(30);
    expect(series[0]?.date).toBe('2026-04-22');
    expect(series[29]?.date).toBe('2026-05-21');
    expect(series.every((p) => p.leadCount === 0)).toBe(true);
  });

  it('buckets leads into their UTC date', async () => {
    setQueryResult({
      data: [
        { created_at: '2026-05-21T08:00:00.000Z' },
        { created_at: '2026-05-21T20:30:00.000Z' },
        { created_at: '2026-05-19T03:00:00.000Z' },
      ],
      error: null,
    });
    const series = await getLeadsPerDay(NOW);
    const byDate = Object.fromEntries(series.map((p) => [p.date, p.leadCount]));
    expect(byDate['2026-05-21']).toBe(2);
    expect(byDate['2026-05-19']).toBe(1);
    expect(byDate['2026-05-20']).toBe(0);
  });

  it('returns the zero-filled empty shape on error', async () => {
    setQueryResult({ data: null, error: { message: 'timeout' } });
    const series = await getLeadsPerDay(NOW);
    expect(series).toHaveLength(30);
    expect(series.every((p) => p.leadCount === 0)).toBe(true);
  });
});

describe('getLeadsBySource', () => {
  it('returns all 3 sources with zero leadCount on empty input', async () => {
    setQueryResult({ data: [], error: null });
    const out = await getLeadsBySource(NOW);
    expect(out).toEqual([
      { source: 'whatsapp', leadCount: 0 },
      { source: 'contact_form', leadCount: 0 },
      { source: 'call_click', leadCount: 0 },
    ]);
  });

  it('counts each source correctly and keeps canonical ordering', async () => {
    setQueryResult({
      data: [
        { source: 'whatsapp' },
        { source: 'whatsapp' },
        { source: 'whatsapp' },
        { source: 'contact_form' },
        { source: 'call_click' },
        { source: 'call_click' },
      ],
      error: null,
    });
    const out = await getLeadsBySource(NOW);
    expect(out).toEqual([
      { source: 'whatsapp', leadCount: 3 },
      { source: 'contact_form', leadCount: 1 },
      { source: 'call_click', leadCount: 2 },
    ]);
  });

  it('ignores unknown source values defensively', async () => {
    setQueryResult({
      data: [{ source: 'whatsapp' }, { source: 'whatsapp' }, { source: 'sms' }],
      error: null,
    });
    const out = await getLeadsBySource(NOW);
    const wa = out.find((s) => s.source === 'whatsapp');
    expect(wa?.leadCount).toBe(2);
  });
});

describe('getTopCities', () => {
  it('returns empty array when no leads have a city', async () => {
    setQueryResult({ data: [], error: null });
    const out = await getTopCities(NOW);
    expect(out).toEqual([]);
  });

  it('sorts descending by lead count, ties broken alphabetically, caps at 10', async () => {
    setQueryResult({
      data: [
        { city: 'Riyadh' },
        { city: 'Riyadh' },
        { city: 'Riyadh' },
        { city: 'Jeddah' },
        { city: 'Jeddah' },
        { city: 'Dammam' },
        { city: 'Dammam' },
        { city: 'Mecca' },
        { city: 'Tabuk' },
        { city: 'Hail' },
        { city: 'Najran' },
        { city: 'Abha' },
        { city: 'Buraidah' },
        { city: 'Khobar' },
        { city: 'Yanbu' },
      ],
      error: null,
    });
    const out = await getTopCities(NOW);
    expect(out.length).toBe(10);
    expect(out[0]).toEqual({ city: 'Riyadh', leadCount: 3 });
    // Tie at 2: Dammam vs Jeddah — alphabetical order pulls Dammam first.
    expect(out[1]).toEqual({ city: 'Dammam', leadCount: 2 });
    expect(out[2]).toEqual({ city: 'Jeddah', leadCount: 2 });
  });
});
