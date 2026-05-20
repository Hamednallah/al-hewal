import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * axe-core a11y scans for the admin Command Center routes (PR 3.7).
 *
 * Same WCAG 2.1 AA discipline as the public-routes spec: serious +
 * critical violations fail; minor / moderate findings surface in the
 * report but don't gate merging.
 *
 * Every scanned route is exercised in BOTH locales. The admin tree
 * already runs through next-intl + RTL CSS, so the AR pass catches
 * direction-flip regressions and locale-specific role mismatches that
 * the EN pass would never hit.
 *
 * Auth: every route is gated behind the HMAC admin cookie. The
 * `loginAsAdmin` helper signs a deterministic cookie that the running
 * server verifies — no real Supabase round-trip needed. Admin
 * Management surfaces (`/admin/admins*`) are gated to super_admin,
 * so those scans run with `tier: 'super_admin'`.
 *
 * Login + forgot-password pages are public-shaped (no admin cookie
 * required), but they're conceptually part of the admin flow and
 * worth bilingual a11y coverage here.
 */

interface AxeRoute {
  name: string;
  path: string;
  /** Optional super_admin requirement (default: standard_admin is enough). */
  tier?: 'super_admin' | 'standard_admin';
  /** Optional selector to wait on before scanning. Defaults to `main`. */
  waitFor?: string;
  /** Routes that don't require auth (login / forgot). */
  skipAuth?: boolean;
}

const ROUTES: AxeRoute[] = [
  // Auth surfaces — no cookie required; we still want bilingual a11y
  // coverage because users tab through these from the public site.
  { name: 'login', path: '/auth/login', skipAuth: true },
  { name: 'forgot', path: '/auth/forgot', skipAuth: true },

  // Admin core surfaces.
  { name: 'dashboard', path: '/admin' },
  { name: 'properties-list', path: '/admin/properties' },
  { name: 'leads-journal', path: '/admin/leads' },

  // Super_admin-only surfaces.
  { name: 'admins-list', path: '/admin/admins', tier: 'super_admin' },
  { name: 'admins-new', path: '/admin/admins/new', tier: 'super_admin' },
  { name: 'properties-new', path: '/admin/properties/new', tier: 'super_admin' },
];

for (const locale of ['ar', 'en'] as const) {
  for (const route of ROUTES) {
    const tier = route.tier ?? 'standard_admin';
    test(`axe: ${locale} admin ${route.name}`, async ({ context, page }) => {
      if (!route.skipAuth) {
        await loginAsAdmin(context, { tier });
      }

      await page.goto(`/${locale}${route.path}`);
      // Admin surfaces all render <main> via the layout shell; wait for
      // it so axe doesn't race with chrome that mounts after first
      // paint.
      const waitSelector = route.waitFor ?? 'main';
      await page.locator(waitSelector).first().waitFor({ state: 'visible' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      if (blocking.length > 0) {
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
