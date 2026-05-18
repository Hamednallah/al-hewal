import { type NextRequest } from 'next/server';

import { handlePropertyAction } from '@/lib/admin/property-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/properties/[id]/publish
 *
 * Moves a draft property to `status='available'` so it appears on the
 * public catalog. Idempotent: re-publishing an already-available row is
 * a successful no-op from the client's perspective; the audit log will
 * still capture the action.
 *
 * Tier gate: any active admin (standard or super). Hard delete is the
 * only row action restricted to `super_admin` — see DELETE handler in
 * `../route.ts`.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handlePropertyAction(id, {
    auditAction: 'update',
    buildAuditDiff: () => ({ after: { status: 'available' } }),
    mutate: async (client, rowId) => {
      const { data, error } = await client
        .from('properties')
        .update({ status: 'available', updated_at: new Date().toISOString() } as never)
        .eq('id', rowId)
        .select('slug')
        .single();
      if (error) throw error;
      return { slug: (data as { slug: string }).slug };
    },
  });
}
