import 'server-only';

import { NextResponse } from 'next/server';

import { currentAdmin } from '@/lib/auth/admins';
import { writeAuditLog, type AuditEntry } from '@/lib/audit';
import { getAdminById, updateAdmin, type UpdateAdminFields } from '@/lib/data/admins';
import { scrubPii } from '@/lib/pii';

/**
 * Shared handler for admin-management row-action routes (promote, demote,
 * deactivate, reactivate). Each route file stays a few lines:
 *
 *   1. Auth (active super_admin only).
 *   2. UUID validation.
 *   3. Self-action guard — super_admin can't demote / deactivate themselves
 *      (would lock the org out of super_admin tier).
 *   4. Apply the partial update, audit-log it, return.
 *
 * Mirrors `lib/admin/property-action.ts` so the conventions stay aligned
 * across the admin Command Center.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdminActionConfig = {
  /** Audit log action name (e.g. 'promote', 'deactivate'). */
  auditAction: AuditEntry['action'];
  /** Partial update to apply. */
  update: UpdateAdminFields;
  /**
   * If true, the action is a no-op when targeting the calling admin
   * themselves (returns 400 `forbidden_self`). Used by demote +
   * deactivate which would otherwise let a super_admin lock the org out.
   */
  guardSelfAction?: boolean;
};

export async function handleAdminAction(
  id: string,
  config: AdminActionConfig,
): Promise<NextResponse> {
  const actor = await currentAdmin();
  if (!actor) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  if (actor.tier !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }
  if (config.guardSelfAction && actor.sub === id) {
    return NextResponse.json({ success: false, error: 'forbidden_self' }, { status: 400 });
  }

  const before = await getAdminById(id);
  if (!before) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
  }

  try {
    const updated = await updateAdmin(id, config.update);
    await writeAuditLog({
      actorId: actor.sub,
      action: config.auditAction,
      entity: 'admin',
      entityId: id,
      diff: {
        before: { tier: before.tier, status: before.status },
        after: { tier: updated?.tier ?? before.tier, status: updated?.status ?? before.status },
      },
    });
    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    const pgError = err as { code?: string; message?: string; details?: string };
    const pgCode = typeof pgError?.code === 'string' ? pgError.code : null;
    const message =
      typeof pgError?.message === 'string'
        ? pgError.message
        : err instanceof Error
          ? err.message
          : String(err);
    await writeAuditLog({
      actorId: actor.sub,
      action: config.auditAction,
      entity: 'admin',
      entityId: id,
      diff: { error: scrubPii(message), code: pgCode },
    });
    console.warn(
      `[admin-action:${config.auditAction}] failed:`,
      JSON.stringify({ code: pgCode, message }),
    );
    return NextResponse.json({ success: false, error: 'mutation_failed' }, { status: 500 });
  }
}
