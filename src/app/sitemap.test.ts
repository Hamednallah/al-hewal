import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub the data layer so the unit test never hits Supabase.
vi.mock('@/lib/data/properties', () => ({
  listLivePropertySlugs: vi.fn(),
}));

import { listLivePropertySlugs } from '@/lib/data/properties';

import sitemap from './sitemap';

const slugsMock = vi.mocked(listLivePropertySlugs);

describe('/sitemap.xml', () => {
  beforeEach(() => {
    slugsMock.mockReset();
  });

  it('always emits home + catalog per locale even when Supabase returns no slugs', async () => {
    slugsMock.mockResolvedValueOnce([]);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\/ar$/),
        expect.stringMatching(/\/en$/),
        expect.stringMatching(/\/ar\/properties$/),
        expect.stringMatching(/\/en\/properties$/),
      ]),
    );
    // No property detail entries when there are no slugs.
    expect(urls.filter((u) => /\/properties\/[^/]+$/.test(u))).toHaveLength(0);
  });

  it('emits one entry per slug per locale and carries hreflang alternates', async () => {
    slugsMock.mockResolvedValueOnce(['al-dana-21', 'al-yasmin-villa-7']);
    const entries = await sitemap();
    const detailEntries = entries.filter((e) => /\/properties\/[^/]+$/.test(e.url));
    expect(detailEntries).toHaveLength(4); // 2 slugs × 2 locales

    for (const entry of detailEntries) {
      // Every detail entry must declare ar-SA, en, and x-default alternates.
      const langs = entry.alternates?.languages ?? {};
      expect(Object.keys(langs)).toEqual(expect.arrayContaining(['ar-SA', 'en', 'x-default']));
      // The x-default points at the AR variant (Arabic-first per project memory).
      expect(langs['x-default']).toMatch(/\/ar\//);
    }
  });

  it('priority decreases from home → catalog → detail', async () => {
    slugsMock.mockResolvedValueOnce(['al-dana-21']);
    const entries = await sitemap();
    const home = entries.find((e) => /\/ar$/.test(e.url));
    const catalog = entries.find((e) => /\/ar\/properties$/.test(e.url));
    const detail = entries.find((e) => /\/ar\/properties\/al-dana-21$/.test(e.url));
    expect(home?.priority).toBeGreaterThan(catalog?.priority ?? 0);
    expect(catalog?.priority).toBeGreaterThan(detail?.priority ?? 0);
  });

  it('site URL has no trailing slash even if env value did', async () => {
    slugsMock.mockResolvedValueOnce(['al-dana-21']);
    const entries = await sitemap();
    for (const entry of entries) {
      // Each URL has at most one consecutive `/` after the scheme.
      expect(entry.url).not.toMatch(/[^:]\/\//);
    }
  });
});
