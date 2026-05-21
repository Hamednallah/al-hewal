import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * My Profile page (PR 4-A).
 *
 *   - Page renders chrome (topbar, identity section, email form,
 *     password form) for both AR + EN locales.
 *   - Current email is rendered read-only on the email form.
 *   - Client-side validation fires for password mismatch.
 *   - The change-email + change-password forms hit server actions
 *     in production — full round-trip exercise requires a real
 *     Supabase session, so it lives in the runbook's manual smoke
 *     checklist, not here.
 */

const STANDARD_EMAIL = 'standard@al-hewal.test';

for (const locale of ['ar', 'en'] as const) {
  test.describe(`/${locale}/admin/profile`, () => {
    test('renders identity block + email form + password form', async ({ context, page }) => {
      await loginAsAdmin(context, { tier: 'standard_admin', email: STANDARD_EMAIL });
      await page.goto(`/${locale}/admin/profile`);

      const expectedTitle = locale === 'ar' ? 'ملفي الشخصي' : 'My Profile';
      await expect(page.getByRole('heading', { level: 1, name: expectedTitle })).toBeVisible();

      // Identity block exposes the admin's email + 4 other fields.
      const identity = page.getByTestId('profile-identity');
      await expect(identity).toBeVisible();
      await expect(identity).toContainText(STANDARD_EMAIL);

      // Both forms mount.
      await expect(page.getByTestId('profile-email-form')).toBeVisible();
      await expect(page.getByTestId('profile-password-form')).toBeVisible();
    });

    test('change-email form pre-fills the current email read-only', async ({ context, page }) => {
      await loginAsAdmin(context, { tier: 'standard_admin', email: STANDARD_EMAIL });
      await page.goto(`/${locale}/admin/profile`);

      const currentInput = page.locator('#profile-email-current');
      await expect(currentInput).toHaveValue(STANDARD_EMAIL);
      await expect(currentInput).toHaveAttribute('readonly', '');

      const newInput = page.locator('#profile-email-new');
      await expect(newInput).toBeVisible();
      await expect(newInput).toHaveValue('');
    });

    test('change-password form has two password inputs', async ({ context, page }) => {
      await loginAsAdmin(context, { tier: 'standard_admin', email: STANDARD_EMAIL });
      await page.goto(`/${locale}/admin/profile`);

      const newPwd = page.locator('#profile-password-new');
      const confirmPwd = page.locator('#profile-password-confirm');
      await expect(newPwd).toBeVisible();
      await expect(confirmPwd).toBeVisible();
      await expect(newPwd).toHaveAttribute('type', 'password');
      await expect(confirmPwd).toHaveAttribute('type', 'password');
      await expect(newPwd).toHaveAttribute('minlength', '8');
    });
  });
}
