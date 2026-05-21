import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * Strategic Analytics dashboard (PR 4-A).
 *
 *   - Page renders chrome (topbar, KPI cards, three chart sections)
 *     for both AR + EN locales.
 *   - Empty-state copy fires when no data is available — which is
 *     the CI default since no leads / whatsapp_clicks rows are
 *     seeded.
 *   - Both admin tiers can read the dashboard.
 *
 * Recharts hydrates client-side; assertions wait for the chart
 * container <div role="img"> elements to be visible, which Recharts
 * mounts as part of the initial render.
 */

for (const locale of ['ar', 'en'] as const) {
  test.describe(`/${locale}/admin/analytics`, () => {
    test(`renders chrome + KPI cards + three chart sections`, async ({ context, page }) => {
      await loginAsAdmin(context, { tier: 'standard_admin' });
      await page.goto(`/${locale}/admin/analytics`);

      // Topbar title — locale-driven heading text.
      const expectedTitle = locale === 'ar' ? 'التقارير الاستراتيجية' : 'Strategic Analytics';
      await expect(page.getByRole('heading', { level: 1, name: expectedTitle })).toBeVisible();

      // KPI cards section. The four labels render as <dt> elements.
      const kpiSection = page.locator('section[aria-labelledby="analytics-kpi-heading"]');
      await expect(kpiSection).toBeVisible();
      const dtCount = await kpiSection.locator('dt').count();
      expect(dtCount).toBe(4);

      // Three chart containers — each is a div[role="img"] with
      // an aria-label set from the locale-specific chart titles.
      await expect(page.locator('div[role="img"]').first()).toBeVisible({ timeout: 10_000 });
      const chartCount = await page.locator('div[role="img"]').count();
      expect(chartCount).toBe(3);
    });

    test('shows empty-state copy when no data is available', async ({ context, page }) => {
      await loginAsAdmin(context, { tier: 'standard_admin' });
      await page.goto(`/${locale}/admin/analytics`);

      const expectedEmpty =
        locale === 'ar'
          ? 'لا توجد بيانات بعد. ستظهر البيانات حال وصول أول العملاء.'
          : 'No data yet. Charts populate once leads start arriving.';
      // CI's placeholder Supabase returns zero rows for every reader,
      // so all three charts render their empty-state overlay.
      const overlays = page.getByText(expectedEmpty);
      await expect(overlays.first()).toBeVisible({ timeout: 10_000 });
    });

    test('renders for super_admin tier too (not gated)', async ({ context, page }) => {
      await loginAsAdmin(context, { tier: 'super_admin' });
      await page.goto(`/${locale}/admin/analytics`);
      const expectedTitle = locale === 'ar' ? 'التقارير الاستراتيجية' : 'Strategic Analytics';
      await expect(page.getByRole('heading', { level: 1, name: expectedTitle })).toBeVisible();
    });
  });
}
