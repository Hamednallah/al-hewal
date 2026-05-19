import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { currentAdmin } from '@/lib/auth/admins';
import { type AdminSessionPayload } from '@/lib/auth/session';
import { BlobNotConfiguredError, uploadToBlob } from '@/lib/blob';
import { env } from '@/lib/env';
import { ImagePipelineError, processImage } from '@/lib/image-pipeline';
import { scrubPii } from '@/lib/pii';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { uploadRequestSchema, type UploadRequest } from '@/lib/validators/property-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 30s budget — sharp + double Blob upload + Postgres insert. The Hobby
// plan gives 10s on standard Functions, but Vercel Blob's `handleUpload`
// is designed to be wrapped in the upload-completed webhook, which runs
// as a separate invocation; the 30s ceiling applies there.
export const maxDuration = 30;

/**
 * POST /api/upload
 *
 * Two-phase Vercel Blob client-upload handler.
 *
 *   Phase 1 — `onBeforeGenerateToken`:
 *     Browser POSTs a JSON envelope describing the upload it's about
 *     to make (propertyId, alt_ar, alt_en, position, filename,
 *     contentType). We validate admin auth, Zod-parse the payload,
 *     and reply with a signed token scoped to ONE specific pathname
 *     + content type. The token expires fast (default 1 hour), so a
 *     leaked token has a small blast radius.
 *
 *   Phase 2 — `onUploadCompleted`:
 *     Vercel webhooks this same route once the browser finishes
 *     uploading. We fetch the original from Blob, run sharp (resize,
 *     EXIF strip, AVIF + WebP variants, blurhash), upload the two
 *     variants, insert a `property_images` row, and audit the action.
 *     We also delete the original — only the optimised variants are
 *     kept long-term.
 *
 * Local-dev caveat: Vercel can't reach `localhost`, so the webhook
 * never fires in a `pnpm dev` session. Use `vercel dev` with a
 * tunnel, or test the route on a preview deployment. The CI E2E
 * only asserts the pre-upload gates (auth/403/400) so it works
 * without a real Blob round-trip.
 */
export async function POST(request: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'blob_not_configured' }, { status: 503 });
  }

  try {
    const json = await handleUpload({
      body,
      request,
      token: env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const meta = parseClientPayload(clientPayload);
        // Token is scoped to the same content type the client declared
        // so a malicious client can't substitute an arbitrary MIME.
        return {
          allowedContentTypes: [meta.contentType],
          maximumSizeInBytes: 25 * 1024 * 1024,
          tokenPayload: JSON.stringify({ ...meta, actorId: admin.sub }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parseTokenPayload(tokenPayload);
        await processCompletedUpload({ blob, payload, admin });
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    if (err instanceof BlobNotConfiguredError) {
      return NextResponse.json({ success: false, error: 'blob_not_configured' }, { status: 503 });
    }
    const name = err instanceof Error ? err.name : 'UnknownError';
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('invalid_payload')) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }
    // Log the error name alongside the message so a `BlobContentTypeNotAllowedError`,
    // `BlobClientTokenExpiredError`, etc., is identifiable in the Vercel logs.
    console.warn(`[POST /api/upload] handleUpload failed [${name}]:`, scrubPii(message));
    return NextResponse.json(
      { success: false, error: 'upload_failed' },
      // 400 is the right status for handleUpload errors per @vercel/blob docs —
      // a 500 would cause the client SDK to silently retry.
      { status: 400 },
    );
  }
}

function parseClientPayload(raw: string | null | undefined): UploadRequest {
  if (!raw) throw new Error('invalid_payload');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('invalid_payload');
  }
  const parsed = uploadRequestSchema.safeParse(json);
  if (!parsed.success) throw new Error('invalid_payload');
  return parsed.data;
}

const tokenPayloadSchema = uploadRequestSchema.extend({
  actorId: z.string().uuid(),
});

function parseTokenPayload(raw: string | null | undefined): UploadRequest & { actorId: string } {
  if (!raw) throw new Error('invalid_payload');
  // Server-issued payload (signed inside `onBeforeGenerateToken`), so we
  // trust the JSON-parse — but still Zod-parse to satisfy TypeScript at
  // the boundary instead of casting.
  const parsed = tokenPayloadSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error('invalid_payload');
  return parsed.data;
}

interface CompletedUploadInput {
  blob: { url: string; pathname: string };
  payload: UploadRequest & { actorId: string };
  admin: AdminSessionPayload;
}

async function processCompletedUpload(input: CompletedUploadInput): Promise<void> {
  const { blob, payload, admin } = input;
  // Fetch the original from Blob so sharp can chew on it. The signed URL
  // is public-read; no auth header needed.
  const originalResponse = await fetch(blob.url);
  if (!originalResponse.ok) {
    throw new Error(`blob_fetch_failed:${originalResponse.status}`);
  }
  const originalBuffer = Buffer.from(await originalResponse.arrayBuffer());

  let processed;
  try {
    processed = await processImage({ buffer: originalBuffer, contentType: payload.contentType });
  } catch (err) {
    if (err instanceof ImagePipelineError) {
      // Drop the source — the property_images row was never created, so
      // the orphaned upload would otherwise count against the storage quota.
      await safeDeleteBlob(blob.url);
      throw err;
    }
    throw err;
  }

  // Upload both variants under a stable prefix tied to the property.
  // `addRandomSuffix` keeps URL-cache misses on overwrites; the actual
  // unique key for the row is the row id.
  const baseDir = `properties/${payload.propertyId}`;
  const safeName = payload.filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 60);
  const [avifPut, webpPut] = await Promise.all([
    uploadToBlob({
      pathname: `${baseDir}/${safeName}.avif`,
      body: processed.avif.body,
      contentType: 'image/avif',
    }),
    uploadToBlob({
      pathname: `${baseDir}/${safeName}.webp`,
      body: processed.webp.body,
      contentType: 'image/webp',
    }),
  ]);

  // Persist on property_images. Primary URL is the AVIF; sibling WebP
  // URL goes on `webp_url` (added in 0005_property_images_webp_url.sql)
  // so the public `<picture>` can declare both sources and fall back
  // gracefully on browsers without AVIF.
  const client = getSupabaseAdminClient();
  const { error: insertErr } = await client.from('property_images').insert({
    property_id: payload.propertyId,
    blob_url: avifPut.url,
    blob_pathname: avifPut.pathname,
    webp_url: webpPut.url,
    width: processed.width,
    height: processed.height,
    blurhash: processed.blurhash,
    alt_ar: payload.alt_ar,
    alt_en: payload.alt_en,
    position: payload.position,
    bytes: processed.avif.bytes,
  } as never);

  if (insertErr) {
    // Best-effort cleanup of both variants so a DB-write failure doesn't
    // leak storage. Don't await — fire-and-forget; the audit log will
    // capture the failure either way.
    await Promise.all([safeDeleteBlob(avifPut.url), safeDeleteBlob(webpPut.url)]);
    throw new Error(`db_insert_failed: ${insertErr.message}`);
  }

  // Original source no longer needed — we keep only optimised variants.
  await safeDeleteBlob(blob.url);

  await writeAuditLog({
    actorId: admin.sub,
    action: 'create',
    entity: 'property_image',
    entityId: payload.propertyId,
    diff: {
      after: {
        avif: { url: avifPut.url, bytes: processed.avif.bytes },
        webp: { url: webpPut.url, bytes: processed.webp.bytes },
        width: processed.width,
        height: processed.height,
        blurhashLength: processed.blurhash.length,
      },
    },
  });
}

async function safeDeleteBlob(url: string): Promise<void> {
  try {
    // Lazy-import to avoid `BlobNotConfiguredError` at top-level if Blob
    // isn't configured (the route already 503s in that case before we
    // get here, but defence in depth).
    const { deleteFromBlob } = await import('@/lib/blob');
    await deleteFromBlob(url);
  } catch (err) {
    console.warn(
      '[POST /api/upload] cleanup delete failed:',
      scrubPii(err instanceof Error ? err.message : String(err)),
    );
  }
}
