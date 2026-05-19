import { type NextRequest, NextResponse } from 'next/server';

import { writeAuditLog } from '@/lib/audit';
import { currentAdmin } from '@/lib/auth/admins';
import { BlobNotConfiguredError, deleteFromBlob, uploadToBlob } from '@/lib/blob';
import { env } from '@/lib/env';
import {
  ACCEPTED_INPUT_MIME_TYPES,
  type AcceptedInputMimeType,
  MAX_INPUT_BYTES,
} from '@/lib/image-constants';
import { ImagePipelineError, processImage } from '@/lib/image-pipeline';
import { scrubPii } from '@/lib/pii';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { uploadMetadataSchema } from '@/lib/validators/property-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 30s budget — sharp (× 2 variants in parallel) + two Blob `put` calls +
// Postgres insert. Hobby Functions get 10s on the standard config; the
// 30s cap kicks in via the runtime hint below so an admin uploading a
// 25 MB Gemini PNG doesn't time out mid-encode.
export const maxDuration = 30;

/**
 * POST /api/upload
 *
 * Server-side multipart image upload (PR 3.5d).
 *
 * Receives the file directly via `multipart/form-data` from the admin's
 * browser, then:
 *   1. Auth + tier gate (active admin).
 *   2. Token presence check (returns 503 if `BLOB_READ_WRITE_TOKEN`
 *      isn't configured — see docs/PHASE_3_RUNBOOK.md §6).
 *   3. Validates the File (mime allowlist + size cap).
 *   4. Zod-parses the metadata (propertyId, alt_ar, alt_en, position).
 *   5. Runs the sharp pipeline (resize, EXIF strip, AVIF + WebP variants,
 *      blurhash).
 *   6. Uploads BOTH variants to Vercel Blob in parallel via the
 *      server-side `put()`.
 *   7. Inserts the `property_images` row with both URLs.
 *   8. Audit-logs the action.
 *
 * Why server-side instead of the `@vercel/blob/client` two-phase flow:
 * production hit an opaque 400 from the browser PUT to `vercel.com/api/blob`
 * with no actionable error class surfacing through the SDK. The
 * server-side path eliminates the webhook dance entirely — one POST,
 * one response, the `property_images` row + Blob files exist iff the
 * 200 came back. Plays the same on local dev and preview/production
 * (the client flow needed a public webhook URL Vercel could reach).
 */
export async function POST(request: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  if (!env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'blob_not_configured' }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_form' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: 'missing_file' }, { status: 400 });
  }
  if (file.size > MAX_INPUT_BYTES) {
    return NextResponse.json({ success: false, error: 'input_too_large' }, { status: 400 });
  }
  const mime = file.type.toLowerCase();
  if (!(ACCEPTED_INPUT_MIME_TYPES as readonly string[]).includes(mime)) {
    return NextResponse.json({ success: false, error: 'unsupported_format' }, { status: 400 });
  }

  const parsedMeta = uploadMetadataSchema.safeParse({
    propertyId: formData.get('propertyId'),
    alt_ar: formData.get('alt_ar'),
    alt_en: formData.get('alt_en'),
    position: formData.get('position'),
  });
  if (!parsedMeta.success) {
    return NextResponse.json(
      { success: false, error: 'invalid_body', issues: parsedMeta.error.issues },
      { status: 400 },
    );
  }
  const meta = parsedMeta.data;

  let avifUrl: string | null = null;
  let webpUrl: string | null = null;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processImage({
      buffer,
      contentType: mime as AcceptedInputMimeType,
    });

    // Stable, slug-safe pathname under the property's directory. The
    // Blob `addRandomSuffix` default keeps URL-cache misses on overwrites
    // — the actual unique key for the row is the row id.
    const safeName =
      file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .slice(0, 60) || 'image';
    const baseDir = `properties/${meta.propertyId}`;

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
    avifUrl = avifPut.url;
    webpUrl = webpPut.url;

    const client = getSupabaseAdminClient();
    const { data: row, error: insertErr } = await client
      .from('property_images')
      .insert({
        property_id: meta.propertyId,
        blob_url: avifPut.url,
        blob_pathname: avifPut.pathname,
        webp_url: webpPut.url,
        width: processed.width,
        height: processed.height,
        blurhash: processed.blurhash,
        alt_ar: meta.alt_ar,
        alt_en: meta.alt_en,
        position: meta.position,
        bytes: processed.avif.bytes,
      } as never)
      .select('id')
      .single();

    if (insertErr) {
      throw insertErr;
    }

    await writeAuditLog({
      actorId: admin.sub,
      action: 'create',
      entity: 'property_image',
      entityId: meta.propertyId,
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

    return NextResponse.json({
      success: true,
      data: {
        id: (row as { id: string }).id,
        url: avifPut.url,
        webpUrl: webpPut.url,
        width: processed.width,
        height: processed.height,
      },
    });
  } catch (err) {
    // Best-effort cleanup so a DB-write failure doesn't leak storage —
    // fire-and-forget; we already throw after.
    if (avifUrl) void safeDeleteBlob(avifUrl);
    if (webpUrl) void safeDeleteBlob(webpUrl);

    if (err instanceof BlobNotConfiguredError) {
      return NextResponse.json({ success: false, error: 'blob_not_configured' }, { status: 503 });
    }
    if (err instanceof ImagePipelineError) {
      return NextResponse.json({ success: false, error: err.code }, { status: 400 });
    }

    // Supabase PostgrestError + generic errors — surface the error class
    // name in the log so a future failure (RLS, FK, etc.) is debuggable.
    const name = err instanceof Error ? err.name : 'UnknownError';
    const pgError = err as { code?: string; message?: string; details?: string };
    const pgCode = typeof pgError?.code === 'string' ? pgError.code : null;
    const message =
      typeof pgError?.message === 'string'
        ? pgError.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.warn(
      `[POST /api/upload] failed [${name}]:`,
      JSON.stringify({ code: pgCode, message: scrubPii(message) }),
    );
    return NextResponse.json({ success: false, error: 'upload_failed' }, { status: 500 });
  }
}

async function safeDeleteBlob(url: string): Promise<void> {
  try {
    await deleteFromBlob(url);
  } catch (err) {
    console.warn(
      '[POST /api/upload] cleanup delete failed:',
      scrubPii(err instanceof Error ? err.message : String(err)),
    );
  }
}
