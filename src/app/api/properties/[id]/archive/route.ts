import { type NextRequest } from 'next/server';

import { handlePropertyAction } from '@/lib/admin/property-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/properties/[id]/archive
 *
 * Soft-delete: stamps `deleted_at = now()`. The row stays in the table
 * (so audit + analytics history is preserved) but drops out of every
 * public-side query — `listProperties()` etc. filter on `deleted_at is null`.
 * Admins can still see archived rows via the listings filter's
 * "Include archived" checkbox and can restore via `/restore`.
 *
 * Tier gate: any active admin.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const stampedAt = new Date().toISOString();
  return handlePropertyAction(id, {
    auditAction: 'update',
    buildAuditDiff: () => ({ after: { deleted_at: stampedAt } }),
    mutate: async (client, rowId) => {
      const { data, error } = await client
        .from('properties')
        .update({ deleted_at: stampedAt, updated_at: stampedAt } as never)
        .eq('id', rowId)
        .select('slug')
        .single();
      if (error) throw error;
      return { slug: (data as { slug: string }).slug };
    },
  });
}
