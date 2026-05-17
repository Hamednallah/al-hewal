import { expect, test } from '@playwright/test';

test.describe('Property detail page', () => {
  test('unknown slug returns a real 404 status (not a 200 with empty state)', async ({ page }) => {
    // The SEO rule from MASTER_PLAN: missing properties must not poison
    // the index. A 200 with "not found" body would be a soft 404 that
    // Google treats as a thin page.
    const response = await page.goto('/ar/properties/this-slug-does-not-exist-1234567890');
    expect(response).toBeTruthy();
    expect(response!.status()).toBe(404);
  });

  test('unknown slug returns 404 on EN too', async ({ page }) => {
    const response = await page.goto('/en/properties/this-slug-does-not-exist-1234567890');
    expect(response).toBeTruthy();
    expect(response!.status()).toBe(404);
  });
});
