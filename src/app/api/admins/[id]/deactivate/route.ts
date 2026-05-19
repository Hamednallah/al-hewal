import { type NextRequest } from 'next/server';

import { handleAdminAction } from '@/lib/admin/admin-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admins/[id]/deactivate
 *
 * Mark an admin as `status='deactivated'`. They keep their auth.users row
 * (so login attempts surface a real "account disabled" message) but our
 * middleware refuses to mint a session cookie for them. super_admin only,
 * audit-logged, refuses self-deactivate.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleAdminAction(id, {
    auditAction: 'deactivate',
    update: { status: 'deactivated' },
    guardSelfAction: true,
  });
}
