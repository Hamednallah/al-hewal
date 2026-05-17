import { expect, test } from '@playwright/test';

test.describe('SEO surfaces', () => {
  test('/sitemap.xml returns XML with hreflang alternates', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('<urlset');
    // Both locales appear.
    expect(body).toMatch(/\/ar/);
    expect(body).toMatch(/\/en/);
    // hreflang alternates emitted via xhtml:link.
    expect(body).toContain('xhtml:link');
    expect(body).toMatch(/hreflang="ar-SA"/);
    expect(body).toMatch(/hreflang="en"/);
    expect(body).toMatch(/hreflang="x-default"/);
  });

  test('/robots.txt allows public and blocks admin/api/auth', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^User-Agent: \*/im);
    expect(body).toMatch(/^Allow: \//im);
    expect(body).toMatch(/^Disallow: \/admin\//im);
    expect(body).toMatch(/^Disallow: \/api\//im);
    expect(body).toMatch(/^Disallow: \/auth\//im);
    expect(body).toMatch(/^Sitemap:.*\/sitemap\.xml$/im);
  });

  test('AR home emits RealEstateAgent JSON-LD', async ({ page }) => {
    await page.goto('/ar');
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(jsonLd).toBeTruthy();
    const parsed = JSON.parse(jsonLd!);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('RealEstateAgent');
    expect(parsed.address.addressCountry).toBe('SA');
    expect(parsed.inLanguage).toBe('ar');
  });

  test('EN home emits RealEstateAgent JSON-LD with EN inLanguage', async ({ page }) => {
    await page.goto('/en');
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const parsed = JSON.parse(jsonLd!);
    expect(parsed.inLanguage).toBe('en');
    expect(parsed.contactPoint.availableLanguage).toEqual(expect.arrayContaining(['ar', 'en']));
  });

  test('AR home has canonical + hreflang link tags', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ar$/);
    await expect(page.locator('link[hreflang="ar-SA"]')).toHaveAttribute('href', /\/ar$/);
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', /\/en$/);
  });
});
