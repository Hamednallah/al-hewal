import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { currentAdmin } from '@/lib/auth/admins';
import { revalidatePropertyPages } from '@/lib/cache';
import { scrubPii } from '@/lib/pii';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ReorderBody = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * PATCH /api/properties/[id]/images/reorder
 *
 * Reorder all images for a single property. Body shape:
 *
 *   { "orderedIds": ["uuid-1", "uuid-2", "uuid-3", ...] }
 *
 * The order of the array IS the new `position` (0-indexed) for each
 * image. Every image currently associated with the property MUST be
 * present in the array — partial reorders are rejected with `400
 * incomplete_ordering` to avoid leaving rows at stale positions and
 * silently desyncing the grid.
 *
 * Auth: any active admin. Image position is a low-risk, easily
 * reversible mutation, so the gate matches the existing image-delete
 * and image-upload endpoints rather than the super_admin-only feature
 * toggle.
 *
 * Implementation note: PostgREST doesn't expose multi-row UPDATE with
 * a CASE per row in a single statement, so we issue N UPDATEs in
 * parallel. For typical property galleries (≤20 images) this is
 * acceptable; if a property ever grows past ~50 images this should be
 * migrated to a SQL RPC.
 */
export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const { id: propertyId } = await ctx.params;
  if (!UUID_RE.test(propertyId)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await _req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = ReorderBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Duplicate-ID guard: a payload with the same UUID twice would write
  // two rows to the same position and leave one image off-grid.
  const seen = new Set<string>();
  for (const id of parsed.data.orderedIds) {
    if (seen.has(id)) {
      return NextResponse.json({ success: false, error: 'duplicate_id' }, { status: 400 });
    }
    seen.add(id);
  }

  const client = getSupabaseAdminClient();

  // Verify the submitted IDs match the property's current image set
  // exactly. Both halves of the comparison run server-side using the
  // service-role client (RLS-bypassing) so a tampered client cannot
  // reorder another property's images.
  const { data: rows, error: readErr } = await client
    .from('property_images')
    .select('id, properties(slug)')
    .eq('property_id', propertyId);

  if (readErr) {
    console.warn('[PATCH images/reorder] read failed:', scrubPii(readErr.message));
    return NextResponse.json({ success: false, error: 'lookup_failed' }, { status: 500 });
  }

  const dbIds = new Set(((rows ?? []) as { id: string }[]).map((r) => r.id));
  const submitted = parsed.data.orderedIds;
  if (dbIds.size !== submitted.length || submitted.some((id) => !dbIds.has(id))) {
    return NextResponse.json({ success: false, error: 'incomplete_ordering' }, { status: 400 });
  }

  // Issue position updates in parallel. Each row only changes its
  // `position`; no other columns are touched, so the
  // `admins_protect_privileged_fields` trigger (fixed in 0006) doesn't
  // apply here (that trigger only fires on `public.admins`).
  try {
    await Promise.all(
      submitted.map((id, position) =>
        client
          .from('property_images')
          .update({ position })
          .eq('id', id)
          .eq('property_id', propertyId)
          .then(({ error }) => {
            if (error) throw error;
          }),
      ),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[PATCH images/reorder] update failed:', scrubPii(message));
    return NextResponse.json({ success: false, error: 'update_failed' }, { status: 500 });
  }

  const slug = ((rows ?? []) as { properties: { slug: string } | null }[])[0]?.properties?.slug;

  await writeAuditLog({
    actorId: admin.sub,
    action: 'update',
    entity: 'property_image',
    diff: { propertyId, reorderedCount: submitted.length },
  });

  if (slug) {
    await revalidatePropertyPages(slug);
  }

  return NextResponse.json({ success: true, data: { count: submitted.length } });
}
