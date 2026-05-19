import { type NextRequest, NextResponse } from 'next/server';

import { writeAuditLog } from '@/lib/audit';
import { currentAdmin } from '@/lib/auth/admins';
import { deleteFromBlob, BlobNotConfiguredError } from '@/lib/blob';
import { revalidatePropertyPages } from '@/lib/cache';
import { scrubPii } from '@/lib/pii';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * DELETE /api/properties/[id]/images/[imageId]
 *
 * Remove a single image from a property. Deletes both the AVIF + WebP
 * variants from Vercel Blob, then the `property_images` row.
 *
 * Tier: any active admin. Image removal is reversible (re-upload), so
 * unlike property hard-delete this isn't gated to super_admin.
 *
 * Idempotent shape: if either the row OR the Blob is already gone we
 * still respond 200 — the goal is "ensure this image is removed",
 * and a missing object is the desired end state. Blob deletion errors
 * for other reasons are swallowed (logged) so a transient Blob outage
 * doesn't leave the row stuck in the DB.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; imageId: string }> },
) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const { id: propertyId, imageId } = await ctx.params;
  if (!UUID_RE.test(propertyId) || !UUID_RE.test(imageId)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  const client = getSupabaseAdminClient();

  // Read the row first to find both URLs + the property slug for
  // revalidation. `maybeSingle` so a missing-row case lands on the
  // idempotent success path.
  const { data: row, error: readErr } = await client
    .from('property_images')
    .select('blob_url, webp_url, property_id, properties(slug)')
    .eq('id', imageId)
    .eq('property_id', propertyId)
    .maybeSingle();

  if (readErr) {
    console.warn('[DELETE image] read failed:', scrubPii(readErr.message));
    return NextResponse.json({ success: false, error: 'lookup_failed' }, { status: 500 });
  }

  if (!row) {
    // Already gone — succeed silently. No audit entry; nothing changed.
    return NextResponse.json({ success: true, data: { id: imageId } });
  }

  const imageRow = row as {
    blob_url: string;
    webp_url: string | null;
    property_id: string;
    properties: { slug: string } | null;
  };

  try {
    // Delete Blob objects first so a successful Blob delete + failed
    // DB delete leaves a recoverable "orphaned row pointing to a 404"
    // state (admin can retry; nothing leaks). The other order would
    // leak storage on partial failure.
    const urlsToDelete = [imageRow.blob_url, imageRow.webp_url].filter(
      (u): u is string => typeof u === 'string' && u.length > 0,
    );
    if (urlsToDelete.length > 0) {
      try {
        await deleteFromBlob(urlsToDelete);
      } catch (err) {
        if (err instanceof BlobNotConfiguredError) {
          // Token not set — can't reach Blob, but the row still needs
          // to come out of the DB (admin's intent). Log and continue.
          console.warn(
            '[DELETE image] BLOB_READ_WRITE_TOKEN unset; row will be deleted without Blob cleanup',
          );
        } else {
          console.warn(
            '[DELETE image] blob delete failed (continuing with DB delete):',
            scrubPii(err instanceof Error ? err.message : String(err)),
          );
        }
      }
    }

    const { error: delErr } = await client
      .from('property_images')
      .delete()
      .eq('id', imageId)
      .eq('property_id', propertyId);
    if (delErr) throw delErr;

    await writeAuditLog({
      actorId: admin.sub,
      action: 'delete',
      entity: 'property_image',
      entityId: imageId,
      diff: { propertyId, deletedUrls: urlsToDelete.length },
    });

    if (imageRow.properties?.slug) {
      await revalidatePropertyPages(imageRow.properties.slug);
    }

    return NextResponse.json({ success: true, data: { id: imageId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[DELETE image] failed:', scrubPii(message));
    await writeAuditLog({
      actorId: admin.sub,
      action: 'delete',
      entity: 'property_image',
      entityId: imageId,
      diff: { error: scrubPii(message) },
    });
    return NextResponse.json({ success: false, error: 'delete_failed' }, { status: 500 });
  }
}
