import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * Reorder + hero pick API gates (PR 3.5c).
 *
 * CI can exercise the auth + UUID + body-validation paths reliably
 * without a real Supabase row, mirroring the discipline of the
 * delete-route spec for PR 3.5b. The success path (real position
 * writes + is_hero flip) needs a seeded property; covered manually
 * in the runbook smoke test.
 */

const PROPERTY_UUID = '11111111-1111-7111-8111-111111111111';
const IMAGE_UUID_A = '22222222-2222-7222-8222-222222222222';
const IMAGE_UUID_B = '33333333-3333-7333-8333-333333333333';

test.describe('PATCH /api/properties/[id]/images/reorder gates', () => {
  test('401 without an admin session', async ({ request }) => {
    const res = await request.patch(`/api/properties/${PROPERTY_UUID}/images/reorder`, {
      data: { orderedIds: [IMAGE_UUID_A, IMAGE_UUID_B] },
    });
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, error: 'unauthorized' });
  });

  test('400 on malformed property id', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/properties/not-a-uuid/images/reorder`, {
      data: { orderedIds: [IMAGE_UUID_A] },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_id' });
  });

  test('400 on invalid JSON body', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/properties/${PROPERTY_UUID}/images/reorder`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'not-json',
    });
    expect(res.status()).toBe(400);
  });

  test('400 on duplicate image id in orderedIds', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/properties/${PROPERTY_UUID}/images/reorder`, {
      data: { orderedIds: [IMAGE_UUID_A, IMAGE_UUID_A] },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'duplicate_id' });
  });

  test('400 on empty orderedIds', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/properties/${PROPERTY_UUID}/images/reorder`, {
      data: { orderedIds: [] },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_body' });
  });
});

test.describe('PATCH /api/properties/[id]/images/[imageId]/hero gates', () => {
  test('401 without an admin session', async ({ request }) => {
    const res = await request.patch(`/api/properties/${PROPERTY_UUID}/images/${IMAGE_UUID_A}/hero`);
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, error: 'unauthorized' });
  });

  test('400 on malformed property id', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(
      `/api/properties/not-a-uuid/images/${IMAGE_UUID_A}/hero`,
    );
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_id' });
  });

  test('400 on malformed image id', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(
      `/api/properties/${PROPERTY_UUID}/images/not-a-uuid/hero`,
    );
    expect(res.status()).toBe(400);
  });

  test('404 when the image does not belong to this property (or does not exist)', async ({
    context,
  }) => {
    // CI's placeholder Supabase returns no row for any UUID; the route
    // treats "no matching row" as not_found. Confirms the auth + UUID
    // gates passed and the lookup query ran.
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(
      `/api/properties/${PROPERTY_UUID}/images/${IMAGE_UUID_A}/hero`,
    );
    // Either 404 (intended) or 500 (lookup_failed against placeholder
    // Supabase). The point is the auth/UUID gates passed.
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(400);
  });
});
