import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * axe-core a11y scans for the public routes. Runs under the `a11y`
 * Playwright project (see playwright.config.ts → testMatch).
 *
 * We treat WCAG 2.1 AA as the bar: serious + critical violations fail
 * the build. Minor / moderate findings are surfaced in the report but
 * don't gate merging — fix them in follow-ups to keep CI focused on
 * regressions that actually break assistive tech.
 *
 * Each route is scanned in BOTH locales because RTL has its own set of
 * a11y traps (logical-property layout bugs, role mismatches under
 * dir=rtl). Catching them in CI is the point of the exercise.
 */

const ROUTES = [
  { name: 'home', path: '' },
  { name: 'catalog', path: '/properties' },
  { name: 'catalog-empty-filter', path: '/properties?q=__no_match__' },
];

for (const locale of ['ar', 'en'] as const) {
  for (const route of ROUTES) {
    test(`axe: ${locale} ${route.name}`, async ({ page }) => {
      await page.goto(`/${locale}${route.path}`);
      // Wait for the main element to confirm hydration before scanning;
      // axe can race against async chrome that mounts after first paint.
      await page.locator('#main-content').waitFor({ state: 'visible' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      if (blocking.length > 0) {
        // Pretty-print so the CI annotation is actionable.
        const summary = blocking
          .map(
            (v) =>
              `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.length} node(s); first: ${v.nodes[0]?.target}`,
          )
          .join('\n\n');
        throw new Error(`axe found ${blocking.length} blocking violation(s):\n\n${summary}`);
      }

      expect(blocking).toHaveLength(0);
    });
  }
}

test('axe: AR 404 page', async ({ page }) => {
  await page.goto('/ar/properties/this-slug-does-not-exist-1234567890', {
    waitUntil: 'domcontentloaded',
  });
  // 404 page may not have #main-content — just scan whatever rendered.
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(blocking).toHaveLength(0);
});
