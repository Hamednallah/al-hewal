import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * - Tests live in tests/e2e/.
 * - Projects: chromium for the smoke gate (CI default), webkit + firefox
 *   for the cross-browser run we trigger on tags / nightly. The `a11y`
 *   project narrows to the bilingual a11y audit (Playwright + axe-core).
 * - The dev server is started automatically against a build artifact so
 *   we test what we will deploy, not the dev-mode bundle.
 * - Failures upload screenshots + traces + videos as artifacts so the
 *   strict reviewer can inspect any regression frame-by-frame.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'Asia/Riyadh',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'a11y',
      testMatch: /.*\.a11y\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'corepack pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
