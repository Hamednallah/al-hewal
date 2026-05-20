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

  test('placeholder pages each render their topbar + tracking PR tag', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });

    const pages: Array<{ path: string; heading: RegExp; tracking: RegExp }> = [
      // NOTE: `/en/admin/properties` was a placeholder in PR 3.2 but PR 3.3a
      // replaced it with the real Listing Management table. The placeholder
      // assertions for that route now live in `admin-properties.spec.ts`.
      //
      // NOTE: `/en/admin/admins` was a placeholder in PR 3.2 but PR #33
      // (Admin Management UI) replaced it with the real list + invite
      // flow. The page-level assertions for that route now live in
      // `admin-management.spec.ts`.
      //
      // NOTE: `/en/admin/leads` was a placeholder in PR 3.2 but PR 3.6
      // replaced it with the real Leads Journal table. The page-level
      // assertions for that route now live in `admin-leads.spec.ts`.
      {
        path: '/en/admin/analytics',
        heading: /Strategic Analytics/,
        tracking: /Tracking: Phase 4$/,
      },
      { path: '/en/admin/profile', heading: /My Profile/, tracking: /Tracking: Phase 4$/ },
    ];

    for (const { path, heading, tracking } of pages) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      // Anchor to the literal "Tracking: …" pill (rendered by AdminPlaceholder)
      // so the assertion doesn't collide with the same PR string when it
      // appears inside the placeholder body copy.
      await expect(page.getByText(tracking)).toBeVisible();
    }
  });
});
