import { describe, expect, it } from 'vitest';

import robots from './robots';

describe('robots.txt', () => {
  it('emits a single rule that allows / and disallows the protected surfaces', () => {
    const out = robots();
    expect(out.rules).toBeDefined();
    const rules = Array.isArray(out.rules) ? out.rules : [out.rules!];
    expect(rules).toHaveLength(1);
    const rule = rules[0]!;
    expect(rule.userAgent).toBe('*');
    expect(rule.allow).toBe('/');
    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow!];
    expect(disallow).toEqual(expect.arrayContaining(['/admin/', '/api/', '/auth/']));
  });

  it('references the sitemap at the site URL root', () => {
    const out = robots();
    expect(out.sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
  });

  it('declares host', () => {
    const out = robots();
    expect(out.host).toMatch(/^https?:\/\//);
  });
});
