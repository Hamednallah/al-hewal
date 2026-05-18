import { expect, test } from '@playwright/test';

test.describe('admin auth guard (PR 3.1)', () => {
  test('unauthenticated /ar/admin redirects to /ar/auth/login with next param', async ({
    page,
  }) => {
    const response = await page.goto('/ar/admin');
    expect(response).not.toBeNull();
    // Final URL after the middleware redirect lands on the login page.
    await expect(page).toHaveURL(/\/ar\/auth\/login\?next=%2Far%2Fadmin$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('unauthenticated /en/admin redirects to /en/auth/login with next param', async ({
    page,
  }) => {
    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/en\/auth\/login\?next=%2Fen%2Fadmin$/);
  });

  test('login page renders the bilingual magic-link form in EN', async ({ page }) => {
    await page.goto('/en/auth/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Admin sign-in' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  });

  test('login page renders RTL Arabic form', async ({ page }) => {
    await page.goto('/ar/auth/login');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(
      page.getByRole('heading', { level: 1, name: 'تسجيل دخول المشرفين' }),
    ).toBeVisible();
  });

  test('login page surfaces the callback error from query string', async ({ page }) => {
    await page.goto('/en/auth/login?error=notAdmin');
    await expect(page.getByRole('alert')).toContainText(/not registered/i);
  });

  test('login page is non-indexable', async ({ page }) => {
    await page.goto('/ar/auth/login');
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);
  });
});
