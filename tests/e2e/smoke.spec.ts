import { expect, test } from '@playwright/test';

test.describe('Phase 1 smoke', () => {
  test('root redirects to /ar (default locale)', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).toBeTruthy();
    await expect(page).toHaveURL(/\/ar$/);
  });

  test('arabic home renders with dir=rtl and Arabic headline', async ({ page }) => {
    await page.goto('/ar');
    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlDir).toBe('rtl');
    await expect(page.locator('h1')).toContainText('نبني الجودة');
  });

  test('english home renders with dir=ltr and English headline', async ({ page }) => {
    await page.goto('/en');
    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlDir).toBe('ltr');
    await expect(page.locator('h1')).toContainText('We build quality');
  });

  test('html lang attribute matches the active locale', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
