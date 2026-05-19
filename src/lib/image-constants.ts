/**
 * Image upload constants shared between the server (sharp pipeline) and
 * the client (uploader pre-validation).
 *
 * This module is import-safe from BOTH sides — it has no runtime
 * dependencies on sharp, blob SDK, or anything else server-bound.
 * `image-pipeline.ts` is server-only (it pulls in sharp); the client
 * uploader can't import from it directly, so the shared bounds live
 * here and both sides re-export.
 */

export const MAX_DIMENSION_PX = 2400;
export const MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_INPUT_PIXELS = 50_000_000; // 50 MP

/** Strict subset of formats both the client and server accept. */
export const ACCEPTED_INPUT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
] as const;
export type AcceptedInputMimeType = (typeof ACCEPTED_INPUT_MIME_TYPES)[number];
