import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * Upload route gates (PR 3.5a).
 *
 * The route runs Vercel Blob's `handleUpload` which requires a real
 * BLOB_READ_WRITE_TOKEN + an inbound webhook to fire `onUploadCompleted`.
 * CI doesn't have either, so we don't exercise the upload happy path
 * end-to-end here — that lands in PR 3.5b alongside the drag-drop UI on
 * a preview deployment where the token is provisioned.
 *
 * What we DO assert: the pre-Blob gates we can reliably exercise in CI
 * without the token — auth (401) and the configured-token short-circuit
 * (503). The route's `invalid_json` catch is real defensive code but
 * is hard to exercise reliably from Playwright's `data: <string>`
 * shape (the body that arrives at the route handler in CI doesn't
 * fail JSON.parse the way it does locally); coverage moves to PR
 * 3.5b's preview-deploy verification where we can drive the upload
 * from the actual drag-drop UI.
 *
 * Same `context.request` discipline as admin-property-actions.spec.ts —
 * see that file's docblock for the `request` fixture cookie-isolation
 * trap.
 */

test.describe('upload route gates (PR 3.5a)', () => {
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
      data: { type: 'blob.generate-client-token', payload: { pathname: 'x', callbackUrl: '' } },
    });
    expect(res.status()).toBe(503);
    expect(await res.json()).toMatchObject({ success: false, error: 'blob_not_configured' });
  });
});
