import 'server-only';

import { NextResponse } from 'next/server';

import { currentAdmin } from '@/lib/auth/admins';
import { type AdminSessionPayload } from '@/lib/auth/session';
import { writeAuditLog, type AuditEntry } from '@/lib/audit';
import { revalidateAfterFeatureToggle, revalidatePropertyPages } from '@/lib/cache';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { scrubPii } from '@/lib/pii';

/**
 * Shared handler for property row-action routes (PR 3.3b).
 *
 * Each row-action endpoint (`/publish`, `/archive`, `/restore`, `/feature`,
 * `DELETE`) follows the same shape: auth → tier gate → UUID validation →
 * fetch current row (for audit `before` snapshot + slug for revalidation) →
 * mutate → audit → revalidate. This module owns the shape so each route
 * file stays a few lines.
 *
 * The mutation function receives the service-role client + the row id and
 * is responsible for returning either `{ slug }` (full revalidate) or
 * `{ slug, featureToggle: true }` (light revalidate). On thrown errors
 * the audit log records the scrubbed message; the caller sees a 500.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PropertyActionConfig = {
  /** Audit log action name. */
  auditAction: AuditEntry['action'];
  /** If set, only admins of this tier may invoke the route. */
  requireTier?: AdminSessionPayload['tier'];
  /**
   * The mutation. Receives the service-role client + row id + admin
   * session. Must return the affected row's slug so the cache helpers
   * know which public pages to revalidate, plus an optional flag
   * indicating the change was a feature-toggle (lighter revalidation).
   */
  mutate: (
    client: ReturnType<typeof getSupabaseAdminClient>,
    id: string,
    admin: AdminSessionPayload,
  ) => Promise<{ slug: string; featureToggleOnly?: boolean }>;
  /** Free-form payload included in the audit `diff` (after-state). */
  buildAuditDiff?: (input: { id: string; admin: AdminSessionPayload }) => unknown;
};

export async function handlePropertyAction(
  id: string,
  config: PropertyActionConfig,
): Promise<NextResponse> {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  if (config.requireTier && admin.tier !== config.requireTier) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  const client = getSupabaseAdminClient();
  try {
    const result = await config.mutate(client, id, admin);
    await writeAuditLog({
      actorId: admin.sub,
      action: config.auditAction,
      entity: 'property',
      entityId: id,
      diff: config.buildAuditDiff?.({ id, admin }) ?? null,
    });
    if (result.featureToggleOnly) {
      await revalidateAfterFeatureToggle();
    } else if (result.slug) {
      await revalidatePropertyPages(result.slug);
    }
    return NextResponse.json({ success: true, data: { id, slug: result.slug } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Audit the failure too so admins can see attempted-but-failed actions.
    await writeAuditLog({
      actorId: admin.sub,
      action: config.auditAction,
      entity: 'property',
      entityId: id,
      diff: { error: scrubPii(message) },
    });
    console.warn(`[property-action:${config.auditAction}] failed:`, message);
    return NextResponse.json({ success: false, error: 'mutation_failed' }, { status: 500 });
  }
}
