import { type NextRequest } from 'next/server';

import { handleAdminAction } from '@/lib/admin/admin-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admins/[id]/demote
 *
 * Demote a super_admin to standard_admin. super_admin only, audit-logged.
 * Refuses to act on the calling admin themselves (would lock the org out
 * of super_admin if they're the last one).
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleAdminAction(id, {
    auditAction: 'promote',
    update: { tier: 'standard_admin' },
    guardSelfAction: true,
  });
}
