import { expect, test } from '@playwright/test';

test.describe('Catalog page', () => {
  test('AR catalog renders the filter bar + page header', async ({ page }) => {
    await page.goto('/ar/properties');
    await expect(page.locator('h1')).toContainText('العقارات');
    // FilterBar inputs are present. The form AND its labelled input
    // share the same accessible name, so getByLabel resolves ambiguously
    // — narrow to the input via its searchbox role.
    await expect(page.getByRole('searchbox', { name: 'ابحث' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'نوع العقار' })).toBeVisible();
  });

  test('EN catalog renders the filter bar + page header', async ({ page }) => {
    await page.goto('/en/properties');
    await expect(page.locator('h1')).toContainText('Properties');
    await expect(page.getByRole('searchbox', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Property type' })).toBeVisible();
  });

  test('filter submission updates the URL via plain GET form', async ({ page }) => {
    await page.goto('/en/properties');
    // The form uses method=GET so submission just sets searchParams.
    await page.getByRole('searchbox', { name: 'Search' }).fill('al');
    await page.getByRole('button', { name: /apply filters/i }).click();
    await expect(page).toHaveURL(/[?&]q=al/);
    // Page header still present after the navigation.
    await expect(page.locator('h1')).toContainText('Properties');
  });

  test('clear-filters link returns to the unfiltered catalog', async ({ page }) => {
    await page.goto('/en/properties?q=__no_match__');
    // Two "Clear" links exist on the page: one inside the FilterBar's
    // search role, one inside the empty-state CTA. Scope to the empty
    // state by excluding the search region.
    const clear = page
      .getByRole('main')
      .getByRole('link', { name: /^clear$/i })
      .last();
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(page).toHaveURL(/\/en\/properties$/);
  });
});
