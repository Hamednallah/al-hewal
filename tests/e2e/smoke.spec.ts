import { expect, test } from '@playwright/test';

test.describe('Phase 1 smoke', () => {
  test('root always redirects to /ar regardless of browser language', async ({ browser }) => {
    // Two browsers: one advertising Arabic, one English. Both must land on
    // /ar because Al Hewal is Arabic-first and localeDetection is disabled.
    for (const acceptLanguage of ['ar-SA,ar;q=0.9', 'en-US,en;q=0.9']) {
      const context = await browser.newContext({ locale: acceptLanguage.split(',')[0] });
      const page = await context.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': acceptLanguage });
      const response = await page.goto('/');
      expect(response).toBeTruthy();
      await expect(page).toHaveURL(/\/ar$/);
      await context.close();
    }
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
