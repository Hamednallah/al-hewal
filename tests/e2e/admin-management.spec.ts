import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * Admin Management tier gates (PR phase-3-admin-management-ui).
 *
 * Covers the auth + tier guards we can assert in CI without provisioning
 * a real Supabase Auth invite flow:
 *
 *   - `/admin/admins` and `/admin/admins/new` are super_admin only — a
 *     standard_admin gets redirected to /admin
 *   - `POST /api/admins` requires super_admin
 *   - The row-action routes (promote, demote, deactivate, reactivate)
 *     all require super_admin
 *   - Self-action guard: demote / deactivate refuse to act on the
 *     calling admin
 *
 * The happy-path "invite an admin → they accept → they appear as active"
 * spec requires a live Supabase project with email delivery enabled and
 * lands on a preview-deploy verification once the owner provisions SMTP
 * (or sets the bootstrap password via the runbook SQL snippet).
 */

const SUPER_SELF = '00000000-0000-4000-8000-1aaaaaaaaaaa';
const SOMEONE_ELSE = '11111111-1111-4111-8111-111111111111';

test.describe('admin-management routes — tier gates', () => {
  test('POST /api/admins — 401 without an admin session', async ({ request }) => {
    const res = await request.post('/api/admins', {
      data: {
        email: 'newadmin@al-hewal.sa',
        full_name: 'Test Admin',
        tier: 'standard_admin',
      },
    });
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, error: 'unauthorized' });
  });

  test('POST /api/admins — 403 when caller is standard_admin', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.post('/api/admins', {
      data: {
        email: 'newadmin@al-hewal.sa',
        full_name: 'Test Admin',
        tier: 'standard_admin',
      },
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ success: false, error: 'forbidden' });
  });

  test('POST /api/admins — 400 on invalid body (super_admin authed)', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    const res = await context.request.post('/api/admins', {
      data: { email: 'not-an-email', full_name: '', tier: 'owner' },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_body' });
  });

  test('POST /api/admins/:id/promote — 403 when caller is standard_admin', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.post(`/api/admins/${SOMEONE_ELSE}/promote`);
    expect(res.status()).toBe(403);
  });

  test('POST /api/admins/:id/demote — 400 when caller targets themselves (super_admin)', async ({
    context,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin', sub: SUPER_SELF });
    const res = await context.request.post(`/api/admins/${SUPER_SELF}/demote`);
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'forbidden_self' });
  });

  test('POST /api/admins/:id/deactivate — 400 when caller targets themselves', async ({
    context,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin', sub: SUPER_SELF });
    const res = await context.request.post(`/api/admins/${SUPER_SELF}/deactivate`);
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'forbidden_self' });
  });

  test('POST /api/admins/:id/promote — 400 on a malformed id', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    const res = await context.request.post('/api/admins/not-a-uuid/promote');
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_id' });
  });
});

test.describe('admin-management pages — tier gates', () => {
  test('/admin/admins — standard_admin redirected to /admin', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    await page.goto('/ar/admin/admins');
    await expect(page).toHaveURL(/\/ar\/admin\b(?!\/admins)/);
  });

  test('/admin/admins/new — standard_admin redirected to /admin', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    await page.goto('/ar/admin/admins/new');
    await expect(page).toHaveURL(/\/ar\/admin\b(?!\/admins)/);
  });

  test('/admin/admins — super_admin reaches the page', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/admins');
    await expect(page).toHaveURL(/\/en\/admin\/admins$/);
    // Either the table or the empty-state CTA renders.
    const empty = page.getByTestId('admins-empty');
    const table = page.getByTestId('admins-cards');
    await expect(empty.or(table)).toBeVisible();
  });

  test('/admin/admins/new — super_admin reaches the form', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/admins/new');
    await expect(page).toHaveURL(/\/en\/admin\/admins\/new$/);
    await expect(page.locator('input#admin-email')).toBeVisible();
    await expect(page.locator('input#admin-full-name')).toBeVisible();
  });
});
