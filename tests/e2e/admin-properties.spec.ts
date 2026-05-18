import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

test.describe('admin listings (PR 3.3a)', () => {
  test('EN listings renders the empty state when no rows are returned', async ({
    context,
    page,
  }) => {
    // CI Supabase URL is a placeholder, so the listAdminProperties query
    // fails gracefully and the page renders the empty state. That's the
    // assertion: page chrome works AND the empty state is the fallback.
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/properties');

    await expect(page.getByRole('heading', { level: 1, name: 'Listing Management' })).toBeVisible();
    await expect(page.getByTestId('admin-properties-empty')).toBeVisible();
    await expect(page.getByTestId('admin-properties-empty')).toContainText(/No properties yet/i);
    // The "+ Add new property" CTA appears both in the topbar AND in the
    // empty state body — both should target /<locale>/admin/properties/new.
    const ctas = page.getByRole('link', { name: /Add (new property|your first property)/i });
    await expect(ctas.first()).toHaveAttribute('href', '/en/admin/properties/new');
  });

  test('AR listings renders RTL with Arabic chrome', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/ar/admin/properties');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'إدارة العقارات' })).toBeVisible();
    await expect(page.getByTestId('admin-properties-empty')).toContainText('لا توجد عقارات');
  });

  test('filter bar carries every dropdown + search input', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/properties');

    await expect(page.getByLabel('Search')).toBeVisible();
    await expect(page.getByLabel('Status')).toBeVisible();
    await expect(page.getByLabel('Type')).toBeVisible();
    await expect(page.getByLabel('City')).toBeVisible();
    await expect(page.getByLabel('Featured')).toBeVisible();
    await expect(page.getByLabel('Include archived')).toBeVisible();
  });

  test('filter form posts as GET and the URL preserves the active filter set', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/properties');

    await page.getByLabel('Search').fill('villa');
    await page.getByLabel('Status').selectOption('draft');
    await page.getByLabel('Type').selectOption('villa');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page).toHaveURL(
      /\/en\/admin\/properties\?.*q=villa.*status=draft.*type=villa|\/en\/admin\/properties\?.*type=villa.*status=draft.*q=villa/,
    );
    // Re-renders the filter form with the values persisted via defaultValue.
    await expect(page.getByLabel('Search')).toHaveValue('villa');
    await expect(page.getByLabel('Status')).toHaveValue('draft');
    await expect(page.getByLabel('Type')).toHaveValue('villa');
  });

  test('Clear link resets the URL back to the bare /admin/properties path', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/properties?q=villa&status=draft');
    await page.getByRole('link', { name: 'Clear' }).click();
    await expect(page).toHaveURL('/en/admin/properties');
    await expect(page.getByLabel('Search')).toHaveValue('');
  });

  test('standard_admin also sees Listing Management (no tier gate on read)', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    await page.goto('/en/admin/properties');
    await expect(page.getByRole('heading', { level: 1, name: 'Listing Management' })).toBeVisible();
  });
});
