import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/admin-auth';

/**
 * Phase 3 happy-path E2E (PR 3.7) — closes the master-plan
 * deliverable that says "an admin can sign in, create a property,
 * upload an image, publish it, and have it appear on the public
 * site." Runs the full sequence end-to-end against a real Supabase
 * + Vercel Blob (preview deploy or local dev with env vars).
 *
 * Skipped automatically in CI: CI does NOT set
 * `BLOB_READ_WRITE_TOKEN` (see .github/workflows/ci.yml) and the
 * upload step would 503. The same skip-on-token signal is used by
 * `admin-upload.spec.ts`.
 *
 * Scope choice: one full create+upload+publish flow through the
 * EN admin UI is sufficient — the AR admin form rendering is
 * covered by `admin-property-form.spec.ts`. What we DO want to
 * verify bilingually is the public-side rendering of the
 * admin-created property, so the assertion phase checks BOTH
 * `/en/properties/<slug>` and `/ar/properties/<slug>`.
 *
 * Cleanup uses `context.request.delete` so the admin session
 * cookie set by `loginAsAdmin` propagates (per the project
 * memory: the standalone `request` fixture does not carry context
 * cookies; see PR #44 leads journal tests).
 *
 * `DELETE /api/properties/[id]` is a HARD delete that cascades to
 * `property_images` via FK — it leaves no trace in the preview
 * DB, so re-runs do not accumulate. `super_admin` tier is
 * required, which matches the fixture this test logs in as.
 */

const isPreviewEnv = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

test.describe('admin happy path — create, upload, publish, view (PR 3.7)', () => {
  test.skip(
    !isPreviewEnv,
    'preview-only — requires BLOB_READ_WRITE_TOKEN + real Supabase. CI runs hit this skip.',
  );

  // Slug is set explicitly on the form so the test is deterministic
  // when navigating to the public detail page. The timestamp suffix
  // keeps every run unique, so afterEach failures from prior runs
  // don't collide with a new run's slug.
  const runTimestamp = Date.now();
  const slug = `e2e-happy-path-${runTimestamp}`;
  const titleEn = `E2E Happy Path ${runTimestamp}`;
  const titleAr = `اختبار سريع ${runTimestamp}`;
  const descEn = 'End-to-end happy path test property — safe to delete.';
  const descAr = 'عقار اختبار للمسار السعيد - آمن للحذف.';

  // The created property's ID is captured during the test and used
  // by afterEach for cleanup. Module-scoped state is safe here
  // because Playwright runs tests within a describe sequentially
  // and the suite has only one test().
  let createdPropertyId: string | null = null;

  test('super_admin creates → uploads → publishes → public sees it on both locales', async ({
    context,
    page,
  }) => {
    await loginAsAdmin(context, { tier: 'super_admin' });

    // ---- 1. Create -----------------------------------------------------
    await page.goto('/en/admin/properties/new');
    await expect(page.getByRole('heading', { level: 1, name: 'New property' })).toBeVisible();

    await page.getByLabel('Arabic title').fill(titleAr);
    await page.getByLabel('English title').fill(titleEn);
    await page.locator('#prop-slug').fill(slug);
    await page.getByLabel('Arabic description').fill(descAr);
    await page.getByLabel('English description').fill(descEn);
    await page.getByLabel('Price (SAR)').fill('1500000');
    await page.getByLabel('Area (m²)').fill('320');
    await page.getByLabel('Bedrooms').fill('4');
    await page.getByLabel('Bathrooms').fill('3');
    await page.getByLabel('City').fill('Riyadh');

    await page.getByRole('button', { name: 'Create property' }).click();

    // Lands on the new property's edit page. The URL carries the
    // generated UUID, which we capture for cleanup + assertions.
    await page.waitForURL(/\/en\/admin\/properties\/[0-9a-f-]{36}\/edit$/, { timeout: 15_000 });
    const match = page.url().match(/\/properties\/([0-9a-f-]{36})\/edit/);
    expect(match).not.toBeNull();
    // match[1] is the captured UUID. Non-null assertion is safe after
    // the expect above; tsconfig's noUncheckedIndexedAccess otherwise
    // types tuple indexes as `string | undefined`.
    createdPropertyId = match![1]!;

    // Draft banner should be visible: the freshly-created row has
    // status=draft, so PropertyDraftBanner mounts above the form.
    await expect(page.getByTestId('property-draft-banner')).toBeVisible();

    // ---- 2. Upload -----------------------------------------------------
    // The dropzone wraps a hidden <input type="file">. setInputFiles
    // targets the input directly even though it's visually hidden.
    await page
      .getByTestId('property-image-dropzone')
      .locator('input[type="file"]')
      .setInputFiles('./tests/fixtures/sample-400x300.jpg');

    // The image pipeline (sharp resize + AVIF/WebP + Blob put +
    // DB insert) takes 2-5 seconds in practice. Generous timeout
    // covers cold preview deploys.
    await expect(page.getByTestId('property-images-grid')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid^="property-image-tile-"]').first()).toBeVisible({
      timeout: 20_000,
    });

    // ---- 3. Publish ----------------------------------------------------
    // The draft banner's "Publish now" button POSTs to
    // /api/properties/[id]/publish, then router.refresh() re-renders
    // the page — at which point status is no longer draft and the
    // banner unmounts. Waiting for the banner to disappear is the
    // cleanest "publish succeeded" signal.
    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(page.getByTestId('property-draft-banner')).toBeHidden({ timeout: 10_000 });

    // ---- 4. Public-side visibility — EN -------------------------------
    await page.goto(`/en/properties/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: titleEn })).toBeVisible({
      timeout: 10_000,
    });
    // Hero image renders. The pipeline serves <img> with the Blob
    // CDN URL; we just assert that at least one img has a non-empty
    // src that includes the storage host marker.
    const heroImg = page.locator('article img').first();
    await expect(heroImg).toBeVisible();
    const src = await heroImg.getAttribute('src');
    expect(src).toBeTruthy();
    // Vercel Blob serves from `<storeId>.public.blob.vercel-storage.com`
    // for stores configured with public access (the project's setup
    // since runbook §6).
    expect(src).toMatch(/vercel-storage\.com/);

    // ---- 5. Public-side visibility — AR (RTL) ------------------------
    await page.goto(`/ar/properties/${slug}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: titleAr })).toBeVisible({
      timeout: 10_000,
    });
  });

  test.afterEach(async ({ context }) => {
    if (!createdPropertyId) return;
    const id = createdPropertyId;
    createdPropertyId = null;
    try {
      const res = await context.request.delete(`/api/properties/${id}`);
      // Don't fail the test on a teardown blip — the preview DB is
      // throwaway and a manual sweep is acceptable. Annotate so
      // flake patterns surface in the Playwright report.
      if (!res.ok()) {
        test.info().annotations.push({
          type: 'cleanup',
          description: `DELETE /api/properties/${id} returned ${res.status()}`,
        });
      }
    } catch (err) {
      test.info().annotations.push({
        type: 'cleanup',
        description: `DELETE /api/properties/${id} threw: ${(err as Error).message}`,
      });
    }
  });
});
