import { type NextRequest } from 'next/server';

import { handleAdminAction } from '@/lib/admin/admin-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admins/[id]/reactivate
 *
 * Re-enable a previously-deactivated admin. super_admin only, audit-logged.
 * Self-action allowed (no destructive consequence).
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleAdminAction(id, {
    auditAction: 'deactivate',
    update: { status: 'active' },
  });
}
