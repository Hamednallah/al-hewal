import { type NextRequest, NextResponse } from 'next/server';

import { currentAdmin } from '@/lib/auth/admins';
import { withAudit } from '@/lib/audit';
import { revalidatePropertyPages } from '@/lib/cache';
import { handlePropertyAction } from '@/lib/admin/property-action';
import { updatePropertySchema } from '@/lib/validators/property';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/properties/[id]
 *
 * Admin-only property update. Accepts a partial payload (every field is
 * optional). On success, revalidates the public property pages so the
 * catalog + detail surfaces pick up the change without waiting for ISR.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = updatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Build updateRow from the keys the client ACTUALLY sent. Zod
  // schemas like `featured: z.coerce.boolean().default(false)` fill
  // missing keys with defaults — left as-is, those defaults would
  // silently overwrite existing data (e.g. flipping featured back to
  // false on every routine save) AND falsely trip the super_admin
  // tier guard below for standard_admins editing other fields.
  const rawKeys =
    body !== null && typeof body === 'object'
      ? new Set(Object.keys(body as Record<string, unknown>))
      : new Set<string>();
  const updateRow: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined && rawKeys.has(key)) {
      updateRow[key] = value;
    }
  }
  if (Object.keys(updateRow).length === 0) {
    return NextResponse.json({ success: false, error: 'no_changes' }, { status: 400 });
  }
  // Tier gate: `featured` is a super_admin-only field. Without this guard
  // a standard_admin could bypass `/feature`'s tier check by PATCHing the
  // column through the general edit endpoint. Safe to check `updateRow`
  // (not raw body) now that we strip Zod defaults above.
  if ('featured' in updateRow && admin.tier !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }
  updateRow.updated_at = new Date().toISOString();

  try {
    const updated = await withAudit(
      {
        actorId: admin.sub,
        action: 'update',
        entity: 'property',
        entityId: id,
        diff: { after: updateRow },
      },
      async () => {
        const client = getSupabaseAdminClient();
        const { data: row, error } = await client
          .from('properties')
          .update(updateRow as never)
          .eq('id', id)
          .select('id, slug')
          .single();
        if (error) throw error;
        return row;
      },
    );

    if (updated?.slug) {
      await revalidatePropertyPages(updated.slug);
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('duplicate key') || message.includes('properties_slug_key')) {
      return NextResponse.json({ success: false, error: 'slug_taken' }, { status: 409 });
    }
    console.warn('[PATCH /api/properties/:id] update failed:', message);
    return NextResponse.json({ success: false, error: 'update_failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/properties/[id]
 *
 * Hard delete — removes the row from `properties` and (via cascading
 * FKs) any dependent `property_images`. This is destructive and
 * unrecoverable; `super_admin` only. For reversible removal use the
 * `/archive` action (soft-delete via `deleted_at`).
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handlePropertyAction(id, {
    auditAction: 'delete',
    requireTier: 'super_admin',
    buildAuditDiff: ({ admin }) => ({ deletedBy: admin.sub }),
    mutate: async (client, rowId) => {
      // Capture slug before delete so the revalidation can name the
      // now-defunct public pages it needs to evict.
      const { data: row, error: readErr } = await client
        .from('properties')
        .select('slug')
        .eq('id', rowId)
        .single();
      if (readErr) throw readErr;
      const slug = (row as { slug: string }).slug;
      const { error: delErr } = await client.from('properties').delete().eq('id', rowId);
      if (delErr) throw delErr;
      return { slug };
    },
  });
}
