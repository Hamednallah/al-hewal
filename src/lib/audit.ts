import 'server-only';

import { scrubPii } from '@/lib/pii';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Audit-log helpers used by admin mutations in Phase 3+.
 *
 * Two functions:
 *   1. `writeAuditLog(entry)` — append a row to admin_audit_log via
 *      the service-role client. Wraps inserts in try/catch so a failure
 *      to log never blocks the actual user-facing request.
 *   2. `withAudit(base, handler)` — runs `handler`, then logs the
 *      outcome (success or scrubbed failure) and re-throws on error.
 *
 * The schema in 0001_init.sql constrains action to the `audit_action`
 * enum: `'create' | 'update' | 'delete' | 'login' | 'invite' |
 * 'promote' | 'deactivate' | 'feature_toggle'`. Public-side analytics
 * inserts (whatsapp click, lead form) don't use this log — that data
 * lives in `leads` and `whatsapp_clicks` and is admin-readable via RLS.
 *
 * PII scrubbing for log messages lives in `lib/pii.ts` (pure logic,
 * separately unit-tested).
 */

type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'invite'
  | 'promote'
  | 'deactivate'
  | 'feature_toggle';

export type AuditEntry = {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  diff?: unknown;
  ipHash?: string | null;
  userAgent?: string | null;
};

/**
 * Append a single row to admin_audit_log. Swallows insert failures so
 * a downed audit pipeline never blocks the user-facing request. Logs
 * failures (scrubbed) so we can detect dropped audit lines.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const client = getSupabaseAdminClient();
    const insertRow = {
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      diff: entry.diff ?? null,
      ip_hash: entry.ipHash ?? null,
      user_agent: entry.userAgent ?? null,
    };
    // `diff` is typed `unknown` on the caller-facing AuditEntry interface so
    // each caller can pass whatever before/after shape makes sense for the
    // entity it's logging. The generated Supabase type for the column is
    // `Json | undefined`, which `unknown` doesn't narrow into cleanly — cast
    // at the boundary instead of polluting every caller with a `Json` cast.
    const { error } = await client.from('admin_audit_log').insert(insertRow as never);
    if (error) {
      console.warn('[audit] insert failed:', scrubPii(error.message));
    }
  } catch (err) {
    console.warn(
      '[audit] unexpected failure:',
      scrubPii(err instanceof Error ? err.message : String(err)),
    );
  }
}

/**
 * HOF that runs `handler`, audits the outcome, and re-throws. Use in
 * admin route handlers for any mutation that belongs in the audit trail.
 *
 *   await withAudit({ actorId, action: 'update', entity: 'property', entityId: id }, async () => {
 *     return supabase.from('properties').update(...).eq('id', id);
 *   });
 */
export async function withAudit<T>(base: AuditEntry, handler: () => Promise<T>): Promise<T> {
  try {
    const result = await handler();
    await writeAuditLog(base);
    return result;
  } catch (err) {
    await writeAuditLog({
      ...base,
      diff: { error: scrubPii(err instanceof Error ? err.message : String(err)) },
    });
    throw err;
  }
}
