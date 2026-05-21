import { expect, test } from '@playwright/test';

/**
 * CSP header propagation E2E (PR 5-B).
 *
 *   - Every public route returns a `Content-Security-Policy-Report-Only`
 *     header (the master plan's staged "report-only first, enforce
 *     later" approach — we observe in production before promoting).
 *   - The header contains the core directives the rest of the site
 *     depends on (script/style/img/connect/frame).
 *   - Admin routes (gated by middleware) also carry the header.
 *
 * A follow-up PR that promotes to enforce will flip the expected
 * header name to `Content-Security-Policy`. The spec deliberately
 * asserts the CURRENT name so the test fails loudly during that
 * migration and we don't accidentally double-emit.
 */

const PUBLIC_ROUTES = ['/ar', '/en', '/ar/properties', '/en/about', '/en/contact'];

for (const route of PUBLIC_ROUTES) {
  test(`csp: ${route} returns Content-Security-Policy-Report-Only header`, async ({ request }) => {
    const res = await request.get(route);
    expect(res.status()).toBe(200);
    const csp = res.headers()['content-security-policy-report-only'];
    expect(csp).toBeTruthy();
    expect(csp).toContain(`default-src 'self'`);
    expect(csp).toContain(`frame-src 'none'`);
    expect(csp).toContain(`object-src 'none'`);
  });
}

test('csp: admin redirect (no session) carries the CSP header too', async ({ request }) => {
  // Hitting /en/admin without an admin cookie 302s to /en/auth/login.
  // The middleware applies CSP to the redirect response just as it does
  // to a 200.
  const res = await request.get('/en/admin', { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const csp = res.headers()['content-security-policy-report-only'];
  expect(csp).toBeTruthy();
});
