import { type NextRequest, NextResponse } from 'next/server';

import { writeAuditLog } from '@/lib/audit';
import { currentAdmin } from '@/lib/auth/admins';
import { revalidatePropertyPages } from '@/lib/cache';
import { scrubPii } from '@/lib/pii';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/properties/[id]/images/[imageId]/hero
 *
 * Mark a single `property_images` row as the hero image for its
 * property and clear `is_hero` on every sibling row. The catalog
 * card + public detail page already prefer rows with `is_hero=true`
 * (see `src/lib/data/properties.ts`), so flipping this field is the
 * end-to-end mechanism for "set as hero".
 *
 * Auth: any active admin (matches reorder + delete).
 *
 * Constraints recap (migration 0003):
 *   - `property_images.is_hero` is `not null default false`.
 *   - Partial-unique index `property_images_one_hero_per_property` on
 *     `(property_id) where is_hero = true` guarantees at most one
 *     hero per property — but Postgres unique constraints are
 *     evaluated at statement end, so a single UPDATE that flips
 *     siblings off and the target on in one statement is safe.
 *
 * Implementation: PostgREST doesn't support `set is_hero = (id = $1)`
 * with a CASE in a simple builder call, so we issue two UPDATEs:
 *   1. Clear is_hero on every OTHER image for this property.
 *   2. Set is_hero on the target.
 * Both run with the service-role client. There's a small window
 * between (1) and (2) where the property has no hero — acceptable
 * because the only readers are public catalog queries that handle
 * the no-hero case anyway, and admin reads-after-write happen via
 * `router.refresh()` after both writes complete.
 */
export async function PATCH(
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

  // Verify the image belongs to this property AND read the slug for
  // cache revalidation.
  const { data: row, error: readErr } = await client
    .from('property_images')
    .select('id, properties(slug)')
    .eq('id', imageId)
    .eq('property_id', propertyId)
    .maybeSingle();

  if (readErr) {
    console.warn('[PATCH image/hero] read failed:', scrubPii(readErr.message));
    return NextResponse.json({ success: false, error: 'lookup_failed' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
  }

  try {
    // Step 1: clear is_hero on every sibling.
    const { error: clearErr } = await client
      .from('property_images')
      .update({ is_hero: false })
      .eq('property_id', propertyId)
      .neq('id', imageId);
    if (clearErr) throw clearErr;

    // Step 2: set is_hero on the target.
    const { error: setErr } = await client
      .from('property_images')
      .update({ is_hero: true })
      .eq('id', imageId)
      .eq('property_id', propertyId);
    if (setErr) throw setErr;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[PATCH image/hero] update failed:', scrubPii(message));
    return NextResponse.json({ success: false, error: 'update_failed' }, { status: 500 });
  }

  await writeAuditLog({
    actorId: admin.sub,
    action: 'update',
    entity: 'property_image',
    entityId: imageId,
    diff: { propertyId, after: { is_hero: true } },
  });

  const slug = (row as { properties: { slug: string } | null }).properties?.slug;
  if (slug) {
    await revalidatePropertyPages(slug);
  }

  return NextResponse.json({ success: true, data: { id: imageId, is_hero: true } });
}
