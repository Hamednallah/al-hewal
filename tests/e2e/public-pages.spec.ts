import { expect, test } from '@playwright/test';

test.describe('/about page', () => {
  test('AR /about renders header + values list', async ({ page }) => {
    await page.goto('/ar/about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('عقار سعودي');
    // Five numbered value items.
    await expect(page.getByRole('listitem').filter({ hasText: /\d{2}/ })).toHaveCount(5, {
      timeout: 2000,
    });
  });

  test('EN /about renders header + CTAs in both flavours', async ({ page }) => {
    await page.goto('/en/about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Saudi real estate');
    await expect(page.getByRole('link', { name: /browse projects/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /contact us/i }).first()).toBeVisible();
  });
});

test.describe('/contact page', () => {
  test('AR /contact renders direct channels + form', async ({ page }) => {
    await page.goto('/ar/contact', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('تحدّث إلى الحوال');
    // Direct channels: WhatsApp link routes through the tracked endpoint.
    const wa = page.getByRole('complementary').getByRole('link', { name: /محادثة عبر واتساب/ });
    await expect(wa).toBeVisible();
    expect(await wa.getAttribute('href')).toMatch(/\/api\/whatsapp\/track\?locale=ar/);
    // Form fields are present.
    await expect(page.getByLabel('الاسم')).toBeVisible();
    await expect(page.getByLabel('رقم الجوال (يفضل واتساب)')).toBeVisible();
  });

  test('EN /contact form validation surfaces inline errors on bad input', async ({ page }) => {
    await page.goto('/en/contact', { waitUntil: 'domcontentloaded' });
    // Empty submit → name + phone become invalid (Zod min(1) / min(6)).
    await page.getByRole('button', { name: /send message/i }).click();
    // The first invalid field should be marked aria-invalid="true".
    const nameInput = page.getByLabel('Your name');
    await expect(nameInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('EN /contact submits a well-formed payload', async ({ page }) => {
    await page.goto('/en/contact', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Your name').fill('Test User');
    await page.getByLabel('Phone (WhatsApp preferred)').fill('0501234567');
    await page.getByLabel('Email (optional)').fill('test@example.com');
    // Intercept the POST so the assertion is independent of any real
    // Supabase availability — we're testing the form, not the route.
    let capturedBody: Record<string, unknown> | null = null;
    await page.route('**/api/leads', async (route) => {
      capturedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByRole('status')).toContainText(/Message received/i);
    // Defaults to a general inquiry when the user doesn't change the radio.
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.inquiryType).toBe('general');
  });
});

test.describe('/contact inquiry-type (general vs maintenance)', () => {
  test('EN /contact renders both inquiry-type options with general pre-selected', async ({
    page,
  }) => {
    await page.goto('/en/contact', { waitUntil: 'domcontentloaded' });
    const general = page.getByLabel('General inquiry');
    const maintenance = page.getByLabel('Maintenance request');
    await expect(general).toBeVisible();
    await expect(maintenance).toBeVisible();
    await expect(general).toBeChecked();
    await expect(maintenance).not.toBeChecked();
  });

  test('AR /contact renders both inquiry-type options translated', async ({ page }) => {
    await page.goto('/ar/contact', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('استفسار عام')).toBeVisible();
    await expect(page.getByLabel('طلب صيانة')).toBeVisible();
  });

  test('selecting maintenance swaps the message placeholder', async ({ page }) => {
    await page.goto('/en/contact', { waitUntil: 'domcontentloaded' });
    const message = page.getByLabel('Message');
    await expect(message).toHaveAttribute('placeholder', /what you'?re looking for/i);
    await page.getByLabel('Maintenance request').check();
    await expect(message).toHaveAttribute('placeholder', /unit number/i);
  });

  test('maintenance submission posts inquiryType=maintenance and shows the maintenance success copy', async ({
    page,
  }) => {
    await page.goto('/en/contact', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Maintenance request').check();
    await page.getByLabel('Your name').fill('Maintenance Customer');
    await page.getByLabel('Phone (WhatsApp preferred)').fill('0501234567');
    await page.getByLabel('Message').fill('Building 3, unit 12 — leaking faucet');
    let capturedBody: Record<string, unknown> | null = null;
    await page.route('**/api/leads', async (route) => {
      capturedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByRole('status')).toContainText(/maintenance team/i);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.inquiryType).toBe('maintenance');
  });
});

test.describe('Bilingual 404', () => {
  test('unknown property slug returns 404 with bilingual content', async ({ page }) => {
    const response = await page.goto('/ar/properties/this-slug-does-not-exist-1234567890', {
      waitUntil: 'domcontentloaded',
    });
    // SEO contract from PR 2.4: real 404 status, not a soft-404 with 200.
    expect(response?.status()).toBe(404);
    // Both the AR heading AND the EN heading must be visible.
    // (Next 15 doesn't reliably resolve not-found.tsx inside route
    // groups for notFound() calls — see app/not-found.tsx comment —
    // so the global bilingual 404 is the rendered surface.)
    await expect(page.locator('[lang="ar"]').first()).toContainText('هذه الصفحة');
    await expect(page.locator('[lang="en"]').first()).toContainText('This page isn');
    // Both CTAs render — at least one Arabic and one English browse link.
    await expect(page.getByRole('link', { name: 'تصفح العقارات' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse Properties/i })).toBeVisible();
  });

  test('unknown property slug carries the brand logo in the 404 chrome', async ({ page }) => {
    await page.goto('/en/properties/this-slug-does-not-exist-9999', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('img', { name: /Al Hewal|الحوال/ })).toBeVisible();
  });
});
