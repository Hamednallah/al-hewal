import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { currentAdmin } from '@/lib/auth/admins';
import { writeAuditLog } from '@/lib/audit';
import { revalidatePropertyPages } from '@/lib/cache';
import { getPropertyAmenityIds, setPropertyAmenities } from '@/lib/data/admin-amenities';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/properties/[id]/amenities
 *
 * Replaces the property's amenity set with the submitted list of
 * `amenity_id` values. Admins of any tier may call it; auth is
 * verified on every request (the property mutation routes follow
 * the same pattern in `lib/admin/property-action.ts`).
 *
 * Body: `{ amenityIds: number[] }` — the full target set. The
 * handler diffs against the current set so the audit log records
 * what changed (not the entire state).
 *
 * The property's public pages get revalidated on success so the
 * `AmenitiesList` section reflects the new state immediately.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  amenityIds: z
    .array(z.number().int().positive().max(32_767))
    .max(50, 'too many amenities — pick the relevant ones'),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;

  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
  }

  // De-dupe submitted IDs — the client UI shouldn't send duplicates,
  // but the PK constraint on (property_id, amenity_id) would fail
  // the bulk insert if it did.
  const targetIds = Array.from(new Set(parsed.data.amenityIds)).sort((a, b) => a - b);

  const beforeIds = await getPropertyAmenityIds(id);
  const result = await setPropertyAmenities(id, targetIds);
  if (result === null) {
    return NextResponse.json({ success: false, error: 'update_failed' }, { status: 500 });
  }

  // Diff so audit captures the change, not the full state.
  const added = result.filter((amenityId) => !beforeIds.includes(amenityId));
  const removed = beforeIds.filter((amenityId) => !result.includes(amenityId));

  await writeAuditLog({
    actorId: admin.sub,
    action: 'update',
    entity: 'property',
    entityId: id,
    diff: { amenities: { added, removed, total: result.length } },
  });

  // Read the slug so we can revalidate the public pages. Best-effort.
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client.from('properties').select('slug').eq('id', id).single();
    if (!error && data) {
      await revalidatePropertyPages((data as { slug: string }).slug);
    }
  } catch (err) {
    console.warn('[PATCH amenities] revalidate failed:', err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ success: true, data: { amenityIds: result } });
}
