import { expect, test } from '@playwright/test';

/**
 * PDPL consent banner E2E (PR 5-A).
 *
 *   - Banner renders on first visit (no `alh_consent` cookie).
 *   - Banner disappears after clicking Accept.
 *   - Banner doesn't re-render on subsequent navigations in the
 *     same context (cookie persists).
 *
 * Both locales tested because the banner copy + button order are
 * locale-driven (RTL flips the flex row).
 */

for (const locale of ['ar', 'en'] as const) {
  test.describe(`/${locale}/ — consent banner`, () => {
    test('renders on first visit when no cookie is set', async ({ page, context }) => {
      // Belt-and-suspenders: clear any pre-existing cookie from a
      // prior parallel-worker run that might have raced.
      await context.clearCookies();

      await page.goto(`/${locale}`);
      const banner = page.getByTestId('consent-banner');
      await expect(banner).toBeVisible();

      const expectedAccept = locale === 'ar' ? 'موافق' : 'Accept';
      await expect(page.getByTestId('consent-accept')).toHaveText(expectedAccept);
    });

    test('disappears after Accept click + does not re-render on next nav', async ({
      page,
      context,
    }) => {
      await context.clearCookies();
      await page.goto(`/${locale}`);

      const banner = page.getByTestId('consent-banner');
      await expect(banner).toBeVisible();

      await page.getByTestId('consent-accept').click();
      // The banner self-dismisses locally on a 200 response.
      await expect(banner).toBeHidden({ timeout: 5_000 });

      // Confirm the cookie was set.
      const cookies = await context.cookies();
      const consent = cookies.find((c) => c.name === 'alh_consent');
      expect(consent?.value).toBe('v1');

      // Navigate to a different public route; banner should NOT
      // re-render because the cookie is now present and the layout
      // skips the component server-side.
      await page.goto(`/${locale}/properties`);
      await expect(page.getByTestId('consent-banner')).toHaveCount(0);
    });

    test('does NOT render when cookie is already set', async ({ context, page }) => {
      await context.clearCookies();
      await context.addCookies([
        {
          name: 'alh_consent',
          value: 'v1',
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      await page.goto(`/${locale}`);
      await expect(page.getByTestId('consent-banner')).toHaveCount(0);
    });
  });
}
