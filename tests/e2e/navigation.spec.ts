import { expect, test } from '@playwright/test';

test.describe('Public navigation', () => {
  test('AR home → catalog via primary CTA preserves locale', async ({ page }) => {
    await page.goto('/ar', { waitUntil: 'domcontentloaded' });
    // Hero Browse-Projects CTA renders as <Button asChild><Link/></Button>.
    // The Radix Slot pattern needs React hydration to wire React's onClick;
    // a click that lands BEFORE hydration falls through to the native <a>
    // navigation. Both should reach /ar/properties — we wait for either.
    const cta = page.getByRole('link', { name: /تصفح المشاريع/ }).first();
    await Promise.all([page.waitForURL(/\/ar\/properties$/), cta.click()]);
    await expect(page.locator('h1')).toContainText('العقارات');
  });

  test('EN home → catalog via primary CTA preserves locale', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    const cta = page.getByRole('link', { name: /browse projects/i }).first();
    await Promise.all([page.waitForURL(/\/en\/properties$/), cta.click()]);
    await expect(page.locator('h1')).toContainText('Properties');
  });

  test('LangSwitcher round-trips AR → EN → AR on the catalog page', async ({ page }) => {
    await page.goto('/ar/properties', { waitUntil: 'domcontentloaded' });
    // The lang switcher button reads the OTHER locale's name as a hint
    // (English when on AR, العربية when on EN).
    const enLink = page.getByRole('link', { name: 'English' }).first();
    await Promise.all([page.waitForURL(/\/en\/properties/), enLink.click()]);
    const arLink = page.getByRole('link', { name: 'العربية' }).first();
    await Promise.all([page.waitForURL(/\/ar\/properties/), arLink.click()]);
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
