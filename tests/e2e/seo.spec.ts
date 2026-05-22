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

  test('AR home emits brand favicon, apple-icon, and manifest links', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('link[rel="icon"][href*="favicon.ico"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"][href*="icon-32.png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"][href*="icon-192.png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"][href*="icon-512.png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      /apple-icon\.png/,
    );
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      /manifest\.webmanifest/,
    );
  });

  test('favicon assets resolve with correct content types', async ({ request }) => {
    const expectations: Array<[string, RegExp]> = [
      ['/favicon.ico', /image\/(x-icon|vnd\.microsoft\.icon)/],
      ['/icon-32.png', /image\/png/],
      ['/apple-icon.png', /image\/png/],
      ['/icon-192.png', /image\/png/],
      ['/icon-512.png', /image\/png/],
    ];
    for (const [path, mime] of expectations) {
      const res = await request.get(path);
      expect(res.status(), `${path} should 200`).toBe(200);
      expect(res.headers()['content-type'], `${path} content-type`).toMatch(mime);
    }
  });

  test('web manifest exposes brand identity', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    const manifest = (await res.json()) as {
      name: string;
      theme_color: string;
      icons: Array<{ src: string; sizes: string }>;
    };
    expect(manifest.name).toContain('Al Haual');
    expect(manifest.theme_color.toLowerCase()).toBe('#002b2b');
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
  });
});
