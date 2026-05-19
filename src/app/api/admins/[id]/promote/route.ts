import { type NextRequest } from 'next/server';

import { handleAdminAction } from '@/lib/admin/admin-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admins/[id]/promote
 *
 * Promote a standard_admin to super_admin. super_admin only, audit-logged.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleAdminAction(id, {
    auditAction: 'promote',
    update: { tier: 'super_admin' },
  });
}
