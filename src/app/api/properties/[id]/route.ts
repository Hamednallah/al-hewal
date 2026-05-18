import { type NextRequest, NextResponse } from 'next/server';

import { currentAdmin } from '@/lib/auth/admins';
import { withAudit } from '@/lib/audit';
import { revalidatePropertyPages } from '@/lib/cache';
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

  // Strip undefined keys so Supabase doesn't try to overwrite with NULL
  // for fields the form chose not to update.
  const updateRow: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateRow[key] = value;
  }
  if (Object.keys(updateRow).length === 0) {
    return NextResponse.json({ success: false, error: 'no_changes' }, { status: 400 });
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
