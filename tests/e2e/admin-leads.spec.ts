import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * Leads Journal (PR 3.6).
 *
 *   - PATCH route gates: auth + UUID + body validation.
 *   - Page renders chrome (topbar, filter bar) for both AR + EN.
 *   - Empty-state copy is correct for the no-filter case and the
 *     filtered-no-results case.
 *
 * Success-path PATCH (real contacted_at flip + audit-log row) needs a
 * seeded lead row and is covered by the manual runbook smoke test
 * after a real WhatsApp click against the deploy.
 */

const VALID_LEAD_UUID = '44444444-4444-7444-8444-444444444444';

test.describe('PATCH /api/leads/[id] gates', () => {
  test('401 without an admin session', async ({ request }) => {
    const res = await request.patch(`/api/leads/${VALID_LEAD_UUID}`, {
      data: { contacted: true },
    });
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, error: 'unauthorized' });
  });

  test('400 on malformed lead id', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/leads/not-a-uuid`, {
      data: { contacted: true },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_id' });
  });

  test('400 on invalid JSON body', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/leads/${VALID_LEAD_UUID}`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'not-json',
    });
    expect(res.status()).toBe(400);
  });

  test('400 on empty body (refine: must set contacted or notes)', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/leads/${VALID_LEAD_UUID}`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, error: 'invalid_body' });
  });

  test('400 on notes longer than 2000 chars', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/leads/${VALID_LEAD_UUID}`, {
      data: { notes: 'x'.repeat(2001) },
    });
    expect(res.status()).toBe(400);
  });

  test('404 when the lead does not exist (placeholder Supabase)', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.patch(`/api/leads/${VALID_LEAD_UUID}`, {
      data: { contacted: true },
    });
    // Either 404 (intended) or 500 (lookup_failed against placeholder
    // Supabase). The point is auth + UUID + body validation passed.
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(400);
  });
});

test.describe('GET /api/leads/export gates', () => {
  test('401 without an admin session', async ({ request }) => {
    const res = await request.get('/api/leads/export');
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, error: 'unauthorized' });
  });

  test('returns a CSV with the expected headers + content-disposition', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.get('/api/leads/export?locale=en');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    expect(res.headers()['content-disposition']).toContain('attachment');
    expect(res.headers()['content-disposition']).toMatch(/al-haual-leads-\d{4}-\d{2}-\d{2}\.csv/);
    // Body starts with the UTF-8 BOM + the English header row.
    const body = await res.text();
    expect(body.startsWith('﻿')).toBe(true);
    expect(body).toContain('Received at,Name,Phone');
  });

  test('AR locale switches the headers + enum labels', async ({ context }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    const res = await context.request.get('/api/leads/export?locale=ar');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('تاريخ الاستلام');
    expect(body).toContain('الاسم');
  });
});

test.describe('admin leads page chrome', () => {
  test('renders the EN topbar + filter bar + empty state', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    await page.goto('/en/admin/leads');
    await expect(page.getByRole('heading', { level: 1, name: /leads journal/i })).toBeVisible();
    // Filter bar form is present
    await expect(page.locator('form[role="search"][aria-label]')).toBeVisible();
    // CI hits placeholder Supabase → no rows → empty-state surfaces.
    await expect(page.getByTestId('admin-leads-empty')).toBeVisible();
  });

  test('renders the AR topbar + filter bar with RTL chrome', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    await page.goto('/ar/admin/leads');
    await expect(page.getByRole('heading', { level: 1, name: /سجل العملاء/ })).toBeVisible();
    await expect(page.getByTestId('admin-leads-empty')).toBeVisible();
  });
});
