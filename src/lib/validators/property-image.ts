import { z } from 'zod';

import { ACCEPTED_INPUT_MIME_TYPES } from '@/lib/image-pipeline';

/**
 * Schemas for the `/api/upload` route's two-phase Vercel Blob client
 * upload (PR 3.5a).
 *
 * Phase 1 (`onBeforeGenerateToken`): the browser POSTs a small payload
 * describing the upload it's about to make. We Zod-parse the payload,
 * gate by admin auth + tier, then return a token-scoped signed URL.
 *
 * Phase 2 (`onUploadCompleted`): Vercel Blob webhooks our route with
 * the uploaded file's metadata once the browser finishes. We Zod-parse
 * the webhook payload (defence against a forged callback), run the
 * sharp pipeline, and upsert `property_images`.
 *
 * Field bounds mirror the `property_images` CHECK constraints in
 * 0001_init.sql (`alt_ar`/`alt_en` not-empty, dims ≤ 8000, bytes > 0).
 */

export const uploadRequestSchema = z.object({
  /** UUID of the parent property the new image belongs to. */
  propertyId: z.string().uuid(),
  /** Bilingual alt text — both required so the public catalog is a11y-complete. */
  alt_ar: z.string().trim().min(1).max(500),
  alt_en: z.string().trim().min(1).max(500),
  /** Render order on the property detail gallery. 0-indexed, max 99. */
  position: z.coerce.number().int().min(0).max(99).default(0),
  /** Original filename — surfaced only in the audit log + Blob pathname. */
  filename: z.string().trim().min(1).max(255),
  /** Declared content type. Re-validated server-side before sharp runs. */
  contentType: z.enum(ACCEPTED_INPUT_MIME_TYPES),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;
