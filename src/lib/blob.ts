import 'server-only';

import { del, put, type PutBlobResult } from '@vercel/blob';

import { env } from '@/lib/env';

/**
 * Thin wrapper around `@vercel/blob` server functions.
 *
 * Two reasons this exists:
 *   1. Centralises the `BLOB_READ_WRITE_TOKEN` lookup so callers can't
 *      forget to pass it — the SDK reads `process.env.BLOB_READ_WRITE_TOKEN`
 *      by default, but our env is wrapped in a lazy Zod Proxy that should
 *      be the authoritative source.
 *   2. Single place to put guarded fallbacks when the token is missing
 *      (e.g. local dev without Blob set up): callers get a clear
 *      `BlobNotConfiguredError` instead of an opaque SDK error.
 *
 * Pricing note (free-tier discipline): every `put` counts toward the
 * 5 GB storage / 100 GB bandwidth monthly cap on the Hobby plan. The
 * sharp pipeline in `image-pipeline.ts` writes 2 variants (AVIF + WebP)
 * per source upload — that doubles the per-upload storage cost but is
 * worth it for the public catalog's payload weight.
 */

export class BlobNotConfiguredError extends Error {
  constructor() {
    super(
      'BLOB_READ_WRITE_TOKEN is not configured. See docs/PHASE_3_RUNBOOK.md ' +
        '§6 for the Vercel Blob setup walkthrough.',
    );
    this.name = 'BlobNotConfiguredError';
  }
}

function requireToken(): string {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new BlobNotConfiguredError();
  return token;
}

export interface UploadInput {
  /** Destination pathname under the Blob store (e.g. `properties/abc/hero.avif`). */
  pathname: string;
  /** Raw bytes to upload — Buffer for the sharp pipeline output. */
  body: Buffer;
  /** Required MIME type (e.g. `image/avif`). */
  contentType: string;
  /**
   * If true, the URL embeds a random suffix to avoid CDN-cache collisions
   * when overwriting an existing pathname. Defaults to true; pass false
   * only when the URL must remain stable across re-uploads.
   */
  addRandomSuffix?: boolean;
}

/**
 * Upload a single byte payload to Vercel Blob. Returns the public URL +
 * pathname so the caller can persist them on `property_images`.
 *
 * Throws `BlobNotConfiguredError` if the token is missing. The caller
 * should map that to a 503 (service-unavailable) for the API consumer
 * — it's an ops misconfiguration, not a user error.
 */
export async function uploadToBlob(input: UploadInput): Promise<PutBlobResult> {
  const token = requireToken();
  return put(input.pathname, input.body, {
    access: 'public',
    token,
    contentType: input.contentType,
    addRandomSuffix: input.addRandomSuffix ?? true,
  });
}

/**
 * Delete one or more blobs by URL. Idempotent — deleting a non-existent
 * URL is a no-op. Used by the admin property-delete flow to evict the
 * `property_images` rows' files when a row is hard-deleted.
 */
export async function deleteFromBlob(urls: string | string[]): Promise<void> {
  const token = requireToken();
  await del(urls, { token });
}
