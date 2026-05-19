import { z } from 'zod';

/**
 * Schema for the `/api/upload` server-side multipart form (PR 3.5d).
 *
 * The route accepts `multipart/form-data` with:
 *   - `file` (the image bytes) — validated against ACCEPTED_INPUT_MIME_TYPES
 *     directly on the File object (file.type + file.size), not via Zod.
 *   - `propertyId`, `alt_ar`, `alt_en`, `position` — the metadata Zod-parses
 *     below.
 *
 * Field bounds mirror the `property_images` CHECK constraints in
 * 0001_init.sql (`alt_ar`/`alt_en` not-empty, position 0-99).
 *
 * PR 3.5d replaced the earlier two-phase `@vercel/blob/client#upload` flow
 * (`handleUpload` Phase 1 + Phase 2 webhook) with a one-shot server-side
 * route: browser POSTs the file via FormData, route runs sharp + Blob
 * `put()` + DB insert in a single function invocation. The webhook-based
 * design proved unworkable in production — the browser PUT to Vercel's
 * `vercel.com/api/blob` returned an opaque CORS-shaped 400 with no
 * actionable error class surfacing through the SDK.
 */

export const uploadMetadataSchema = z.object({
  /** UUID of the parent property the new image belongs to. */
  propertyId: z.string().uuid(),
  /** Bilingual alt text — both required so the public catalog is a11y-complete. */
  alt_ar: z.string().trim().min(1).max(500),
  alt_en: z.string().trim().min(1).max(500),
  /** Render order on the property detail gallery. 0-indexed, max 99. */
  position: z.coerce.number().int().min(0).max(99).default(0),
});

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
