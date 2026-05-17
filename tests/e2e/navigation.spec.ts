import { expect, test } from '@playwright/test';

test.describe('Public navigation', () => {
  test('AR home → catalog via primary CTA preserves locale', async ({ page }) => {
    await page.goto('/ar');
    await page
      .getByRole('link', { name: /تصفح المشاريع/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/ar\/properties$/);
    await expect(page.locator('h1')).toContainText('العقارات');
  });

  test('EN home → catalog via primary CTA preserves locale', async ({ page }) => {
    await page.goto('/en');
    await page
      .getByRole('link', { name: /browse projects/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/properties$/);
    await expect(page.locator('h1')).toContainText('Properties');
  });

  test('LangSwitcher round-trips AR → EN → AR on the catalog page', async ({ page }) => {
    await page.goto('/ar/properties');
    // The lang switcher button reads the OTHER locale's name as a hint
    // (English when on AR, العربية when on EN).
    await page.getByRole('link', { name: 'English' }).first().click();
    await expect(page).toHaveURL(/\/en\/properties/);
    await page.getByRole('link', { name: 'العربية' }).first().click();
    await expect(page).toHaveURL(/\/ar\/properties/);
  });

  test('skip-to-content link focuses #main-content', async ({ page }) => {
    await page.goto('/ar');
    await page.keyboard.press('Tab');
    // The first focusable element in the chrome is SkipToContent.
    const skipLink = page.locator('a[href="#main-content"]').first();
    await expect(skipLink).toBeFocused();
    await skipLink.click();
    await expect(page.locator('#main-content')).toBeVisible();
  });
});
