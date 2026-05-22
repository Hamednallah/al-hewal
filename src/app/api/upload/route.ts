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

    // First image for the property → flag it as hero automatically.
    // Without a hero image the featured-properties home query (inner
    // join + `is_hero=true` filter) excludes the property entirely, so
    // a freshly-published listing wouldn't appear in the featured rail
    // until the admin remembered to tick "Set as hero" manually. The
    // partial unique index `(property_id) where is_hero = true` keeps
    // us safe if two uploads ever land concurrently — the second
    // insert would error and the admin retry naturally.
    const { count: existingCount, error: countErr } = await client
      .from('property_images')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', meta.propertyId);
    if (countErr) {
      throw countErr;
    }
    const isFirstImage = (existingCount ?? 0) === 0;

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
        is_hero: isFirstImage,
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

    // Vercel Blob: the store was provisioned with `private` access but
    // our `uploadToBlob` requests `access: 'public'` (catalog images are
    // public). Access mode is set at store creation and cannot be
    // changed in place — the owner has to delete the private store and
    // recreate it as public. See docs/PHASE_3_RUNBOOK.md §6 for the
    // walk-through. Surfacing as a distinct 503 + error code so the
    // admin chip reads "Blob store is private; ask the owner to recreate
    // it with public access" instead of a generic "upload_failed".
    if (message.includes('private store') || message.includes('private access')) {
      console.warn(
        `[POST /api/upload] blob_store_not_public — recreate the Vercel Blob store with PUBLIC access per docs/PHASE_3_RUNBOOK.md §6.`,
      );
      return NextResponse.json({ success: false, error: 'blob_store_not_public' }, { status: 503 });
    }

    // Vercel Blob: the token in the env points at a store that no longer
    // exists. Owner has typically just recreated the store (e.g. to flip
    // it from private → public) and Production / Preview still carries
    // the old store's token. See docs/PHASE_3_RUNBOOK.md §6 "Recovery"
    // for the click-by-click env reset.
    if (message.includes('store does not exist') || message.includes('store_not_found')) {
      console.warn(
        `[POST /api/upload] blob_store_not_found — BLOB_READ_WRITE_TOKEN points at a missing store. Reconnect the Vercel Blob store to the project in the dashboard env vars and redeploy. See docs/PHASE_3_RUNBOOK.md §6.`,
      );
      return NextResponse.json({ success: false, error: 'blob_store_not_found' }, { status: 503 });
    }

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
