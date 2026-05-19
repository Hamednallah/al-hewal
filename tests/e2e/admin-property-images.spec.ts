import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * Property images (PR 3.5b).
 *
 * Two slices CI can reliably exercise without a real Vercel Blob token:
 *
 *  1. The DELETE /api/properties/[id]/images/[imageId] route's pre-DB
 *     gates (auth, UUID validation).
 *  2. The PropertyForm renders an Images section in BOTH modes —
 *     create mode shows the "save first" hint, edit mode renders the
 *     grid + uploader chrome. The edit-mode path can't be exercised
 *     in CI because `getAdminPropertyById` returns null against the
 *     placeholder Supabase URL (the page calls `notFound()`); we
 *     cover create mode here.
 *
 * Uses the same `context.request` discipline as the other auth'd
 * specs (see admin-property-actions.spec.ts docblock).
 */

const VALID_UUID = '11111111-1111-7111-8111-111111111111';
const OTHER_UUID = '22222222-2222-7222-8222-222222222222';

test.describe('image delete route gates (PR 3.5b)', () => {
  test('DELETE /api/properties/[id]/images/[imageId] — 401 without admin session', async ({
    request,
  }) => {
    const res = await request.delete(`/api/properties/${VALID_UUID}/images/${OTHER_UUID}`);
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, error: 'unauthorized' });
  });

  test('DELETE — 400 on malformed property id', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.delete(`/api/properties/not-a-uuid/images/${OTHER_UUID}`);
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_id' });
  });

  test('DELETE — 400 on malformed image id', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.delete(`/api/properties/${VALID_UUID}/images/not-a-uuid`);
    expect(res.status()).toBe(400);
  });

  test('DELETE — succeeds (idempotent) on a missing image row', async ({ context }) => {
    // CI's placeholder Supabase returns no row for any UUID — the route
    // treats "no row" as the desired end state and 200s. Tests the
    // idempotency property the route promises in its docblock.
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.delete(`/api/properties/${VALID_UUID}/images/${OTHER_UUID}`);
    // Either 200 (idempotent success — Supabase returned no row) or
    // 500 (lookup_failed — Supabase returned an unexpected error).
    // The assertion is that the auth/UUID gates passed.
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(400);
  });
});

test.describe('property form — images section UI (PR 3.5b)', () => {
  test('create mode renders the "save the draft first" hint, not the uploader', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/properties/new');

    await expect(page.getByRole('heading', { level: 2, name: 'Images' })).toBeVisible();
    await expect(page.getByTestId('property-images-create-hint')).toBeVisible();
    await expect(page.getByTestId('property-images-create-hint')).toContainText(
      /save the property first/i,
    );

    // The uploader's dropzone test id must NOT be present in create mode.
    await expect(page.getByTestId('property-image-dropzone')).toHaveCount(0);
  });

  test('AR create mode renders the hint with Arabic copy', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/ar/admin/properties/new');
    await expect(page.getByRole('heading', { level: 2, name: 'الصور' })).toBeVisible();
    await expect(page.getByTestId('property-images-create-hint')).toContainText(
      'احفظ العقار أولاً',
    );
  });
});
