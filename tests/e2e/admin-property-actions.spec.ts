import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * Row-action route gates (PR 3.3b).
 *
 * The listings page renders the empty state in CI (placeholder Supabase
 * URL), so we can't drive the row-action UI end-to-end without seeded
 * rows. Instead, we exercise the API endpoints directly against signed
 * admin-session cookies — this gives us authoritative coverage of the
 * auth + tier gates that the UI buttons rely on.
 *
 * IMPORTANT: authenticated calls use `context.request.*`, NOT the
 * standalone `request` fixture. The `request` fixture is a separate
 * APIRequestContext that does not share cookies with the browser
 * `context`, so `loginAsAdmin(context, ...)` wouldn't apply to it.
 * `context.request` is bound to the context and inherits its cookies.
 * Unauthenticated 401 cases can use either.
 *
 * The endpoints all hit Supabase as part of the mutation; in CI the
 * placeholder URL makes those calls fail. We don't assert on the
 * Supabase outcome (mutation_failed / 500). We DO assert on the
 * pre-DB checks: unauthorized (401), forbidden (403), invalid_id (400).
 */

const VALID_UUID = '11111111-1111-7111-8111-111111111111';

test.describe('row-action API gates (PR 3.3b)', () => {
  test('POST /publish — 401 without an admin session cookie', async ({ request }) => {
    const res = await request.post(`/api/properties/${VALID_UUID}/publish`);
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, error: 'unauthorized' });
  });

  test('POST /archive — 401 without an admin session cookie', async ({ request }) => {
    const res = await request.post(`/api/properties/${VALID_UUID}/archive`);
    expect(res.status()).toBe(401);
  });

  test('POST /restore — 401 without an admin session cookie', async ({ request }) => {
    const res = await request.post(`/api/properties/${VALID_UUID}/restore`);
    expect(res.status()).toBe(401);
  });

  test('POST /feature — 401 without an admin session cookie', async ({ request }) => {
    const res = await request.post(`/api/properties/${VALID_UUID}/feature`, {
      data: { featured: true },
    });
    expect(res.status()).toBe(401);
  });

  test('DELETE /[id] — 401 without an admin session cookie', async ({ request }) => {
    const res = await request.delete(`/api/properties/${VALID_UUID}`);
    expect(res.status()).toBe(401);
  });

  test('POST /feature — 403 for standard_admin (super_admin only)', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.post(`/api/properties/${VALID_UUID}/feature`, {
      data: { featured: true },
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ success: false, error: 'forbidden' });
  });

  test('DELETE /[id] — 403 for standard_admin (super_admin only)', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.delete(`/api/properties/${VALID_UUID}`);
    expect(res.status()).toBe(403);
  });

  test('PATCH /[id] — 403 for standard_admin updating `featured`', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/properties/${VALID_UUID}`, {
      data: { featured: true },
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ success: false, error: 'forbidden' });
  });

  test('PATCH /[id] — standard_admin CAN update non-featured fields (no 403)', async ({
    context,
  }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/properties/${VALID_UUID}`, {
      data: { city: 'Riyadh' },
    });
    // Either 500 (mutation_failed against placeholder Supabase) or 200 if
    // Supabase happened to accept it — the assertion is that tier gating
    // didn't block it.
    expect(res.status()).not.toBe(403);
    expect(res.status()).not.toBe(401);
  });

  test('POST /publish — 400 for a malformed property id', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    const res = await context.request.post(`/api/properties/not-a-uuid/publish`);
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_id' });
  });

  test('POST /feature — 400 when body is missing the `featured` boolean', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    const res = await context.request.post(`/api/properties/${VALID_UUID}/feature`, {
      data: { something: 'else' },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_body' });
  });
});
