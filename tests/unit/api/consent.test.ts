import { beforeEach, describe, expect, it } from 'vitest';

import { POST, CONSENT_COOKIE_NAME, CONSENT_COOKIE_VALUE } from '@/app/api/consent/route';

/**
 * Lightweight unit coverage for the consent endpoint. The route is
 * effectively three checks: same-origin guard, set the cookie,
 * return 200. No DB, no auth, no rate limit — easy to exercise.
 */

const SAME_ORIGIN = 'http://localhost:3000';
const OTHER_ORIGIN = 'https://evil.example.com';

// node's fetch implementation refuses to surface "forbidden" headers
// like Origin/Referer that came from script land (matches the
// browser fetch spec). The route reads them via `req.headers.get(...)`
// so the test just hands it a minimal shape with that method. The
// route doesn't touch any other Request surface, so this is enough.
function makeRequest(opts: { origin?: string | null; referer?: string | null }) {
  const map = new Map<string, string>();
  if (opts.origin) map.set('origin', opts.origin);
  if (opts.referer) map.set('referer', opts.referer);
  return {
    headers: {
      get: (name: string) => map.get(name.toLowerCase()) ?? null,
    },
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = SAME_ORIGIN;
});

describe('POST /api/consent', () => {
  it('sets alh_consent=v1 cookie + 200 on same-origin POST', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest({ origin: SAME_ORIGIN }) as any);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${CONSENT_COOKIE_NAME}=${CONSENT_COOKIE_VALUE}`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
  });

  it('rejects cross-origin POST with 403', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest({ origin: OTHER_ORIGIN }) as any);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'cross_origin' });
  });

  it('rejects POST with no Origin header AND no Referer', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest({}) as any);
    expect(res.status).toBe(403);
  });

  it('accepts POST with no Origin but matching Referer (older agents)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest({ referer: `${SAME_ORIGIN}/ar` }) as any);
    expect(res.status).toBe(200);
  });

  it('rejects POST with malformed Origin', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest({ origin: 'not-a-url' }) as any);
    expect(res.status).toBe(403);
  });

  it('rejects POST with malformed Referer (no Origin)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest({ referer: 'not-a-url' }) as any);
    expect(res.status).toBe(403);
  });

  it('rejects POST with cross-origin Referer (no Origin)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeRequest({ referer: `${OTHER_ORIGIN}/path` }) as any);
    expect(res.status).toBe(403);
  });
});
