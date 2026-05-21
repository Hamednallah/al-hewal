import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

test.describe('admin shell (PR 3.2)', () => {
  test('standard_admin sees the four base nav items + Profile, not Admin Management', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    await page.goto('/en/admin');

    const sidebar = page.getByTestId('admin-sidebar');
    await expect(sidebar).toBeVisible();

    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Listing Management' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Leads Journal' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Strategic Analytics' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'My Profile' })).toBeVisible();

    // Tier filter: standard_admin must NOT see the Admin Management item.
    await expect(sidebar.getByRole('link', { name: 'Admin Management' })).toHaveCount(0);
  });

  test('super_admin sees Admin Management as well', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/en/admin');

    const sidebar = page.getByTestId('admin-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Admin Management' })).toBeVisible();
  });

  test('active nav item carries aria-current=page on each route', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    const sidebar = page.getByTestId('admin-sidebar');

    await page.goto('/en/admin/properties');
    await expect(sidebar.getByRole('link', { name: 'Listing Management' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Dashboard is matchSubpaths=false so it must NOT light up here.
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.goto('/en/admin/leads');
    await expect(sidebar.getByRole('link', { name: 'Leads Journal' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('standard_admin is bounced from the admins URL even if typed directly', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    await page.goto('/en/admin/admins');
    await expect(page).toHaveURL(/\/en\/admin$/);
  });

  test('AR shell renders RTL with Arabic chrome', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });
    await page.goto('/ar/admin');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');

    const sidebar = page.getByTestId('admin-sidebar');
    await expect(sidebar.getByText('مركز القيادة')).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'لوحة التحكم' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'إدارة المشرفين' })).toBeVisible();
  });

  test('sign-out link in the sidebar footer points at /auth/sign-out', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'standard_admin' });
    await page.goto('/en/admin');
    const signOut = page.getByTestId('admin-sidebar').getByRole('link', { name: 'Sign Out' });
    await expect(signOut).toBeVisible();
    expect(await signOut.getAttribute('href')).toContain('/auth/sign-out');
  });

  test('every admin route renders its topbar heading', async ({ context, page }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });

    // Topbar heading assertions only. The original PR 3.2 version of this
    // test also asserted the "Tracking: Phase N" badge that
    // `AdminPlaceholder` rendered — but every admin route now has its
    // real implementation:
    //   - /admin/properties     replaced by PR 3.3a (listings table)
    //   - /admin/admins         replaced by PR #33  (admin management)
    //   - /admin/leads          replaced by PR 3.6  (leads journal)
    //   - /admin/analytics      replaced by PR 4-A  (strategic analytics)
    //   - /admin/profile        replaced by PR 4-A  (my profile)
    // The page-level interaction assertions for each route live in the
    // matching `admin-*.spec.ts` file.
    const pages: Array<{ path: string; heading: RegExp }> = [
      { path: '/en/admin/analytics', heading: /Strategic Analytics/ },
      { path: '/en/admin/profile', heading: /My Profile/ },
    ];

    for (const { path, heading } of pages) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    }
  });
});
