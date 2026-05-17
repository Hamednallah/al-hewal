import { expect, test } from '@playwright/test';

test.describe('WhatsApp conversion tracking', () => {
  test('Hero ctaContact on AR home points at the tracked endpoint', async ({ page }) => {
    await page.goto('/ar');
    const cta = page.getByRole('link', { name: /تواصل عبر واتساب/ }).first();
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toMatch(/\/api\/whatsapp\/track\?locale=ar/);
  });

  test('Hero ctaContact on EN home points at the tracked endpoint', async ({ page }) => {
    await page.goto('/en');
    const cta = page.getByRole('link', { name: /contact via whatsapp/i }).first();
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toMatch(/\/api\/whatsapp\/track\?locale=en/);
  });

  test('Footer WhatsApp link points at the tracked endpoint', async ({ page }) => {
    await page.goto('/ar');
    // Footer renders below the fold on AR home; scroll into view first.
    const footerLink = page
      .getByRole('contentinfo')
      .getByRole('link', { name: /تواصل عبر واتساب/ });
    await footerLink.scrollIntoViewIfNeeded();
    const href = await footerLink.getAttribute('href');
    expect(href).toMatch(/\/api\/whatsapp\/track\?locale=ar/);
  });

  test('/api/whatsapp/track 302-redirects to wa.me', async ({ request }) => {
    // Use a raw request (no auto-follow) so we can inspect the Location.
    const res = await request.get('/api/whatsapp/track?locale=en', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const location = res.headers()['location'];
    expect(location).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  });

  test('/api/whatsapp/track preserves AR message in the redirect', async ({ request }) => {
    const res = await request.get('/api/whatsapp/track?locale=ar', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const location = decodeURIComponent(res.headers()['location'] ?? '');
    // AR greeting starts with السلام عليكم
    expect(location).toContain('السلام عليكم');
  });
});
