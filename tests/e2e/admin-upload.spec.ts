import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * Upload route gates (PR 3.5d — server-side multipart rewrite).
 *
 * Route accepts `multipart/form-data` and runs the full sharp + Blob
 * `put` + DB insert pipeline server-side. CI doesn't have
 * `BLOB_READ_WRITE_TOKEN`, so we can't exercise the happy path
 * end-to-end here — that lands on a preview deployment where the
 * token is provisioned. What we DO assert: auth (401) and the
 * missing-token short-circuit (503), the gates that fire before any
 * form parsing.
 *
 * Same `context.request` discipline as admin-property-actions.spec.ts —
 * see that file's docblock for the `request` fixture cookie-isolation
 * trap.
 */

test.describe('upload route gates (PR 3.5d)', () => {
  test('POST /api/upload — 401 without an admin session cookie', async ({ request }) => {
    const res = await request.post('/api/upload', { data: { type: 'noop' } });
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, error: 'unauthorized' });
  });

  test('POST /api/upload — 503 when BLOB_READ_WRITE_TOKEN is not configured', async ({
    context,
  }) => {
    // CI does not set BLOB_READ_WRITE_TOKEN — see .github/workflows/ci.yml.
    // The route short-circuits with 503 before reaching Vercel Blob. This
    // doubles as the "ops misconfig" UX assertion: admins see a real
    // status code, not an opaque 500.
    await loginAsAdmin(context, { tier: 'super_admin' });
    const res = await context.request.post('/api/upload', {
      data: { type: 'noop' },
    });
    expect(res.status()).toBe(503);
    expect(await res.json()).toMatchObject({ success: false, error: 'blob_not_configured' });
  });
});
