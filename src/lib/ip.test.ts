import { beforeAll, describe, expect, it } from 'vitest';

// Required by src/lib/env.ts (lazy Proxy) — must be set before the
// modules below evaluate any env-dependent property.
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'a'.repeat(60);
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 's'.repeat(60);
process.env.NEXT_PUBLIC_WHATSAPP_PHONE ??= '966500000000';

import { dailySalt, extractClientIp, hashIp } from './ip';

describe('extractClientIp', () => {
  it('prefers x-vercel-forwarded-for over x-forwarded-for', () => {
    const h = new Headers({
      'x-vercel-forwarded-for': '5.5.5.5',
      'x-forwarded-for': '1.1.1.1, 2.2.2.2',
    });
    expect(extractClientIp(h)).toBe('5.5.5.5');
  });

  it('falls back to the first entry in x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(extractClientIp(h)).toBe('203.0.113.5');
  });

  it('honours cf-connecting-ip ahead of x-forwarded-for', () => {
    const h = new Headers({
      'cf-connecting-ip': '198.51.100.7',
      'x-forwarded-for': '203.0.113.5',
    });
    expect(extractClientIp(h)).toBe('198.51.100.7');
  });

  it('returns null when no recognised header is present', () => {
    const h = new Headers({ 'user-agent': 'Mozilla' });
    expect(extractClientIp(h)).toBeNull();
  });

  it('trims whitespace around the first IP', () => {
    const h = new Headers({ 'x-forwarded-for': '   203.0.113.5  ,  10.0.0.1' });
    expect(extractClientIp(h)).toBe('203.0.113.5');
  });
});

describe('dailySalt + hashIp', () => {
  const day1 = new Date('2026-05-18T10:00:00Z');
  const day1Other = new Date('2026-05-18T23:59:59Z');
  const day2 = new Date('2026-05-19T00:00:01Z');

  it('returns the same salt anywhere within a UTC day', () => {
    expect(dailySalt(day1)).toBe(dailySalt(day1Other));
  });

  it('rotates the salt across UTC days', () => {
    expect(dailySalt(day1)).not.toBe(dailySalt(day2));
  });

  it('hashIp is deterministic same-day and rotates next-day', () => {
    const a = hashIp('203.0.113.5', day1);
    const b = hashIp('203.0.113.5', day1Other);
    const c = hashIp('203.0.113.5', day2);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('hashIp returns null for null input', () => {
    expect(hashIp(null, day1)).toBeNull();
  });

  it('hashIp output is a 64-char hex SHA-256 digest', () => {
    const out = hashIp('203.0.113.5', day1);
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different IPs produce different hashes within the same day', () => {
    expect(hashIp('203.0.113.5', day1)).not.toBe(hashIp('203.0.113.6', day1));
  });

  // Side-effect guard: just confirms the env was honoured during setup.
  beforeAll(() => {
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
  });
});
