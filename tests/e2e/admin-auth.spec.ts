import { expect, test } from '@playwright/test';

test.describe('admin auth guard (PR 3.1, updated PR phase-3-auth-password)', () => {
  test('unauthenticated /ar/admin redirects to /ar/auth/login with next param', async ({
    page,
  }) => {
    const response = await page.goto('/ar/admin');
    expect(response).not.toBeNull();
    await expect(page).toHaveURL(/\/ar\/auth\/login\?next=%2Far%2Fadmin$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('unauthenticated /en/admin redirects to /en/auth/login with next param', async ({
    page,
  }) => {
    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/en\/auth\/login\?next=%2Fen%2Fadmin$/);
  });

  test('login page renders the email + password form in EN', async ({ page }) => {
    await page.goto('/en/auth/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Admin sign-in' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    // Forgot-password link is the only self-service recovery surface
    // before the Admin Management invite flow ships.
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toBeVisible();
  });

  test('login page renders RTL Arabic form', async ({ page }) => {
    await page.goto('/ar/auth/login');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(
      page.getByRole('heading', { level: 1, name: 'تسجيل دخول المشرفين' }),
    ).toBeVisible();
    await expect(page.getByLabel('كلمة المرور')).toBeVisible();
  });

  test('login page surfaces the callback error from query string', async ({ page }) => {
    await page.goto('/en/auth/login?error=notAdmin');
    await expect(page.locator('main').getByRole('alert')).toContainText(
      /registered as an al haual administrator/i,
    );
  });

  test('login page is non-indexable', async ({ page }) => {
    await page.goto('/ar/auth/login');
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);
  });
});

test.describe('admin password reset (PR phase-3-auth-password)', () => {
  test('EN /auth/forgot renders the reset-request form', async ({ page }) => {
    await page.goto('/en/auth/forgot');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Reset your password' }),
    ).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email me a reset link' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign-in' })).toBeVisible();
  });

  test('AR /auth/forgot renders RTL with Arabic copy', async ({ page }) => {
    await page.goto('/ar/auth/forgot');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(
      page.getByRole('heading', { level: 1, name: 'إعادة تعيين كلمة المرور' }),
    ).toBeVisible();
  });

  test('EN /auth/reset-password renders the set-new-password form', async ({ page }) => {
    // Without a `?code=...`, the page skips the Supabase exchange and
    // renders the form directly (admins already mid-reset can refresh
    // without losing the form). Form submit will surface
    // `expiredSession` if there's no Supabase cookie.
    await page.goto('/en/auth/reset-password');
    await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
    // `getByLabel` is non-exact by default — "New password" is a
    // substring of "Confirm new password", so we need `exact: true`
    // to keep this from resolving to 2 elements (strict-mode violation).
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm new password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save password' })).toBeVisible();
  });

  test('/auth/forgot is non-indexable', async ({ page }) => {
    await page.goto('/en/auth/forgot');
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);
  });

  test('/auth/reset-password is non-indexable', async ({ page }) => {
    await page.goto('/en/auth/reset-password');
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);
  });
});
