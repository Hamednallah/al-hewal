import { type NextRequest } from 'next/server';

import { handlePropertyAction } from '@/lib/admin/property-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/properties/[id]/restore
 *
 * Inverse of `/archive` — clears `deleted_at`, returning the row to the
 * normal admin + public queries. Status is left untouched, so a restored
 * row goes back to whatever publish state it had before archival.
 *
 * Tier gate: any active admin.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const stampedAt = new Date().toISOString();
  return handlePropertyAction(id, {
    auditAction: 'update',
    buildAuditDiff: () => ({ after: { deleted_at: null } }),
    mutate: async (client, rowId) => {
      const { data, error } = await client
        .from('properties')
        .update({ deleted_at: null, updated_at: stampedAt } as never)
        .eq('id', rowId)
        .select('slug')
        .single();
      if (error) throw error;
      return { slug: (data as { slug: string }).slug };
    },
  });
}
