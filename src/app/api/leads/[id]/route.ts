import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { currentAdmin } from '@/lib/auth/admins';
import { getLeadById } from '@/lib/data/admin-leads';
import { scrubPii } from '@/lib/pii';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PatchBody = z
  .object({
    /** ISO-8601 timestamp string, or `null` to clear. Server uses the
     *  string verbatim if provided, otherwise `now()` when `true`. */
    contacted: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (v) => v.contacted !== undefined || v.notes !== undefined,
    'At least one of `contacted` or `notes` must be present.',
  );

/**
 * PATCH /api/leads/[id]
 *
 * Update a lead's follow-up state. Two fields are mutable from the
 * admin Leads Journal (PR 3.6):
 *
 *   - `contacted`: when `true`, sets `contacted_at = now()`. When
 *     `false`, clears it back to NULL (in case an admin marked it
 *     contacted by mistake).
 *   - `notes`: free-text follow-up note, up to 2000 chars. Setting
 *     `null` clears the note.
 *
 * Auth: any active admin. The Leads table is internal-only — no tier
 * gate needed.
 *
 * Audit-logged with before/after snapshots, PII-scrubbed via
 * `scrubPii` since the lead's name / phone / email are in the row
 * (we audit the column diff, not the full row).
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
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const before = await getLeadById(id);
  if (!before) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
  }

  const patch: { contacted_at?: string | null; notes?: string | null } = {};
  if (parsed.data.contacted !== undefined) {
    patch.contacted_at = parsed.data.contacted ? new Date().toISOString() : null;
  }
  if (parsed.data.notes !== undefined) {
    patch.notes = parsed.data.notes === '' ? null : parsed.data.notes;
  }

  try {
    const client = getSupabaseAdminClient();
    const { error } = await client.from('leads').update(patch).eq('id', id);
    if (error) throw error;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[PATCH /api/leads/[id]] update failed:', scrubPii(message));
    return NextResponse.json({ success: false, error: 'update_failed' }, { status: 500 });
  }

  // Diff only the columns we touched (notes / contacted_at). Lead
  // PII (name / phone / email) is NEVER written to the audit log —
  // see lib/audit.ts § "Never log raw PII".
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  if (parsed.data.contacted !== undefined) {
    diff.contacted_at = {
      before: before.contacted_at,
      after: patch.contacted_at ?? null,
    };
  }
  if (parsed.data.notes !== undefined) {
    diff.notes = {
      before: before.notes ? '[set]' : null,
      after: patch.notes ? '[set]' : null,
    };
  }

  await writeAuditLog({
    actorId: admin.sub,
    action: 'update',
    entity: 'lead',
    entityId: id,
    diff,
  });

  return NextResponse.json({
    success: true,
    data: {
      id,
      contacted_at: patch.contacted_at ?? before.contacted_at,
      notes: patch.notes ?? before.notes,
    },
  });
}
