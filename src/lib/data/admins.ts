import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Admin Management data layer (PR phase-3-admin-management-ui).
 *
 * The `/admin/admins` Listing surface needs to show every admin (active,
 * deactivated, pending_invite) regardless of RLS — the page itself is
 * gated to super_admin at the route layer. Uses the service-role client.
 *
 * The bootstrap-admin SQL path (runbook §1 step 2) is replaced by the
 * `inviteAdmin` flow below: super_admin enters an email + name + tier
 * in the UI, we issue a Supabase Auth invite AND insert the matching
 * `public.admins` row with `status='pending_invite'`. When the invitee
 * accepts the invite email, the existing `/auth/reset-password` page
 * accepts the same `?code=…` shape as the password-recovery flow.
 */

export type AdminListRow = {
  id: string;
  email: string;
  full_name: string;
  tier: 'super_admin' | 'standard_admin';
  status: 'active' | 'deactivated' | 'pending_invite';
  language_pref: 'ar' | 'en';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * List every admin. Sorted by `status` (active first), then `created_at`
 * descending so newly-invited admins surface at the top. Pagination is
 * deferred — at the scale of an Al-Hewal-style org the table holds well
 * under 100 rows.
 *
 * Returns an empty list on Supabase failure rather than throwing, so the
 * page can render its chrome + an empty-state instead of a 500.
 */
export async function listAdmins(): Promise<AdminListRow[]> {
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from('admins')
      .select(
        'id, email, full_name, tier, status, language_pref, last_login_at, created_at, updated_at',
      )
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .abortSignal(AbortSignal.timeout(2000));
    if (error) {
      console.warn('[listAdmins] supabase returned error:', error.message);
      return [];
    }
    return (data ?? []) as AdminListRow[];
  } catch (err) {
    console.warn('[listAdmins] unexpected failure:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Look up one admin by id. Used by the row-action helper to read the
 * `before` state for the audit `diff`, and by the API guards that need
 * to verify the target is a real admin.
 */
export async function getAdminById(id: string): Promise<AdminListRow | null> {
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from('admins')
      .select(
        'id, email, full_name, tier, status, language_pref, last_login_at, created_at, updated_at',
      )
      .eq('id', id)
      .abortSignal(AbortSignal.timeout(2000))
      .maybeSingle();
    if (error) {
      console.warn('[getAdminById] supabase returned error:', error.message);
      return null;
    }
    return (data ?? null) as AdminListRow | null;
  } catch (err) {
    console.warn('[getAdminById] unexpected failure:', err instanceof Error ? err.message : err);
    return null;
  }
}

export type InviteAdminInput = {
  email: string;
  full_name: string;
  tier: 'super_admin' | 'standard_admin';
  language_pref?: 'ar' | 'en';
  /**
   * Absolute URL the invite email's "accept" link should redirect to. The
   * Supabase invite flow appends a `?code=…` query param the
   * `/auth/reset-password` page already handles (PR #24 made the
   * recovery + invite link shapes identical).
   */
  redirectTo: string;
};

export type InviteAdminResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: 'email_taken' | 'invite_failed' | 'invite_smtp_failed' | 'insert_failed';
      detail?: string;
    };

/**
 * Issue a Supabase Auth invite AND insert the matching `public.admins`
 * row with `status='pending_invite'`. Both writes use the service-role
 * client — invites are only ever issued from a super_admin context that
 * the route handler enforces.
 *
 * Two-phase write: invite first (creates the `auth.users` row), then
 * insert the `public.admins` row with the auth.users.id as PK. On the
 * second insert failing we DON'T roll back the auth.users row — the
 * invite link is already in flight, and the next attempt for the same
 * email will hit the unique-email constraint, surfacing as `email_taken`.
 */
export async function inviteAdmin(input: InviteAdminInput): Promise<InviteAdminResult> {
  const client = getSupabaseAdminClient();

  // Pre-check: refuse if the email is already an admin. Saves a wasted
  // Supabase invite email + a confusing "email_taken" mid-flow.
  try {
    const { data: existing, error: lookupErr } = await client
      .from('admins')
      .select('id')
      .eq('email', input.email)
      .abortSignal(AbortSignal.timeout(2000))
      .maybeSingle();
    if (lookupErr) {
      console.warn('[inviteAdmin] pre-check failed:', lookupErr.message);
    } else if (existing) {
      return { ok: false, code: 'email_taken' };
    }
  } catch (err) {
    console.warn('[inviteAdmin] pre-check threw:', err instanceof Error ? err.message : err);
    // Continue — let the real Supabase invite call surface a clean error.
  }

  const { data: invited, error: inviteErr } = await client.auth.admin.inviteUserByEmail(
    input.email,
    { redirectTo: input.redirectTo },
  );
  if (inviteErr || !invited?.user) {
    const detail = inviteErr?.message ?? 'unknown';
    const status = (inviteErr as { status?: number } | null)?.status;
    const code = (inviteErr as { code?: string } | null)?.code;
    // Supabase returns "User already registered" when the email already
    // has an auth.users row from a previous (perhaps consumed) invite.
    if (detail.toLowerCase().includes('already registered')) {
      return { ok: false, code: 'email_taken', detail };
    }
    // SMTP failure: Supabase Auth tried to send the invite email and
    // the configured mail relay rejected / timed out. Surfaces as a
    // 500 + `unexpected_failure` from /auth/v1/invite, OR an explicit
    // `Error sending invite email` message on newer Supabase versions.
    // Owner action: configure custom SMTP per docs/PHASE_3_RUNBOOK.md §8.
    if (
      status === 500 ||
      code === 'unexpected_failure' ||
      detail.toLowerCase().includes('sending invite email') ||
      detail.toLowerCase().includes('smtp')
    ) {
      return { ok: false, code: 'invite_smtp_failed', detail };
    }
    return { ok: false, code: 'invite_failed', detail };
  }

  const { error: insertErr } = await client.from('admins').insert({
    id: invited.user.id,
    email: input.email,
    full_name: input.full_name,
    tier: input.tier,
    status: 'pending_invite',
    language_pref: input.language_pref ?? 'en',
  } as never);

  if (insertErr) {
    // The auth.users row is now orphaned. The next invite to this email
    // will see it via the pre-check + return email_taken; the operator
    // can clear the orphan from Supabase Studio if needed. Surface
    // distinctly so the form copy explains.
    console.warn('[inviteAdmin] public.admins insert failed:', insertErr.message);
    return { ok: false, code: 'insert_failed', detail: insertErr.message };
  }

  return { ok: true, id: invited.user.id };
}

export type UpdateAdminFields = {
  tier?: 'super_admin' | 'standard_admin';
  status?: 'active' | 'deactivated';
};

/**
 * Apply a partial update to one admin row. Used by promote / demote /
 * deactivate / reactivate row actions. Returns the updated row's
 * before+after snapshot for the audit log.
 */
export async function updateAdmin(
  id: string,
  fields: UpdateAdminFields,
): Promise<AdminListRow | null> {
  const client = getSupabaseAdminClient();
  const row = {
    ...fields,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client
    .from('admins')
    .update(row as never)
    .eq('id', id)
    .select(
      'id, email, full_name, tier, status, language_pref, last_login_at, created_at, updated_at',
    )
    .single();
  if (error) throw error;
  return (data ?? null) as AdminListRow | null;
}
