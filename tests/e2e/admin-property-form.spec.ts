import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

test.describe('admin property form — create (PR 3.4)', () => {
  test('EN /admin/properties/new renders the form with every required section', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/properties/new');

    await expect(page.getByRole('heading', { level: 1, name: 'New property' })).toBeVisible();
    // Six section headings (Identity, Description, Classification, Pricing,
    // Specifications, Location) — assert the section labels render.
    for (const name of [
      'Identity',
      'Description',
      'Classification',
      'Pricing',
      'Specifications',
      'Location',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    // Required-field markers (bilingual title fields are required).
    await expect(page.getByLabel('Arabic title')).toBeVisible();
    await expect(page.getByLabel('English title')).toBeVisible();
    await expect(page.getByLabel('City')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create property' })).toBeVisible();
  });

  test('AR /admin/properties/new renders RTL with Arabic chrome', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/ar/admin/properties/new');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'عقار جديد' })).toBeVisible();
    await expect(page.getByLabel('العنوان بالعربية')).toBeVisible();
    await expect(page.getByLabel('العنوان بالإنجليزية')).toBeVisible();
  });

  test('empty submit surfaces inline validation errors on required fields', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/properties/new');
    await page.getByRole('button', { name: 'Create property' }).click();
    // RHF + zod marks the first invalid field aria-invalid="true".
    await expect(page.getByLabel('Arabic title')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('English title')).toHaveAttribute('aria-invalid', 'true');
  });

  test('a well-formed payload POSTs to /api/properties and lands on the edit page for the new row', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/properties/new');

    // The destination edit page calls Supabase via `getAdminPropertyById`
    // which returns null against CI's placeholder URL and triggers
    // `notFound()`. The 404 still lives under the same /admin/properties/<id>/edit
    // URL though, which is what we assert below.
    let capturedBody: Record<string, unknown> | null = null;
    let capturedMethod: string | null = null;
    await page.route('**/api/properties', async (route) => {
      capturedMethod = route.request().method();
      capturedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'test-id', slug: 'test-villa' } }),
      });
    });

    await page.getByLabel('Arabic title').fill('فيلا اختبار');
    await page.getByLabel('English title').fill('Test Villa');
    await page.getByLabel('Arabic description').fill('وصف عربي للاختبار');
    await page.getByLabel('English description').fill('English description for the test');
    await page.getByLabel('Price (SAR)').fill('2500000');
    await page.getByLabel('Area (m²)').fill('400');
    await page.getByLabel('Bedrooms').fill('4');
    await page.getByLabel('Bathrooms').fill('3');
    await page.getByLabel('City').fill('Riyadh');

    await page.getByRole('button', { name: 'Create property' }).click();
    // Lands on the edit URL for the newly-created row so admins can
    // immediately add images / publish — the previous "back to listings"
    // behavior buried the row and made the next step unclear.
    await expect(page).toHaveURL(/\/en\/admin\/properties\/test-id\/edit$/);

    expect(capturedMethod).toBe('POST');
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.title_en).toBe('Test Villa');
    expect(capturedBody!.city).toBe('Riyadh');
    // Numeric coercion still works at the form layer.
    expect(capturedBody!.price_sar).toBe(2500000);
    expect(capturedBody!.bedrooms).toBe(4);
  });

  test('server error response surfaces the localised error banner', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin/properties/new');

    await page.route('**/api/properties', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'slug_taken' }),
      });
    });

    await page.getByLabel('Arabic title').fill('عنوان');
    await page.getByLabel('English title').fill('Title');
    await page.getByLabel('Arabic description').fill('وصف');
    await page.getByLabel('English description').fill('Description');
    await page.getByLabel('Price (SAR)').fill('100');
    await page.getByLabel('Area (m²)').fill('100');
    await page.getByLabel('Bedrooms').fill('1');
    await page.getByLabel('Bathrooms').fill('1');
    await page.getByLabel('City').fill('Jeddah');
    await page.getByRole('button', { name: 'Create property' }).click();
    await expect(page.getByTestId('property-form-error')).toContainText(/URL slug/i);
  });
});
