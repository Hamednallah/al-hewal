import 'server-only';

import { cookies } from 'next/headers';

import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  signAdminSession,
  type AdminStatus,
  type AdminTier,
} from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Establish the admin session cookie for an authenticated Supabase user.
 *
 * Shared by every path that turns a freshly-authenticated `auth.users`
 * id into an admin session: the password-login server action, the
 * magic-link / recovery callback, and the invite-acceptance flow that
 * runs through `/<locale>/auth/set-password`. Centralises the admin row
 * lookup + tier/status gate + HMAC cookie sign + last_login_at stamp so
 * the rules can't drift across callers.
 *
 * Accepted admin statuses:
 *   - `active`         → cookie is signed as-is.
 *   - `pending_invite` → the row is flipped to `active` first, then the
 *                        cookie is signed with the post-flip status.
 *                        Reaching this path implies the invitee just set
 *                        their password through the
 *                        `/<locale>/auth/set-password` flow (or completed
 *                        the legacy `/auth/callback` exchange) — Supabase
 *                        would have blocked a normal email+password
 *                        login because no password existed before the
 *                        invite was accepted.
 *   - `deactivated`    → rejected with `notAdmin`. A deactivated admin
 *                        cannot resurrect themselves through recovery.
 *   - missing row      → rejected with `notAdmin`. The Supabase user is
 *                        not an Al Hewal admin.
 *
 * Returns one of:
 *   - `{ ok: true, admin }`  — cookie was set, caller should redirect.
 *   - `{ ok: false, reason }` — caller should NOT set a session and
 *     should surface an error. `reason` maps to the i18n error key
 *     so the form / login page can localise it.
 */

export type EstablishReason = 'notAdmin' | 'lookupFailed';

export type EstablishResult =
  | {
      ok: true;
      admin: { id: string; email: string; tier: AdminTier; status: AdminStatus };
    }
  | { ok: false; reason: EstablishReason };

export async function establishAdminSession(supabaseUserId: string): Promise<EstablishResult> {
  let adminRow: { id: string; email: string; tier: AdminTier; status: AdminStatus } | null = null;
  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from('admins')
      .select('id, email, tier, status')
      .eq('id', supabaseUserId)
      .maybeSingle();
    if (error) {
      console.warn('[establishAdminSession] admin lookup failed:', error.message);
      return { ok: false, reason: 'lookupFailed' };
    }
    if (data) {
      adminRow = data as { id: string; email: string; tier: AdminTier; status: AdminStatus };
    }
  } catch (err) {
    console.warn(
      '[establishAdminSession] admin lookup threw:',
      err instanceof Error ? err.message : err,
    );
    return { ok: false, reason: 'lookupFailed' };
  }

  if (!adminRow || (adminRow.status !== 'active' && adminRow.status !== 'pending_invite')) {
    return { ok: false, reason: 'notAdmin' };
  }

  // Invite acceptance: the invitee just set their password and reached
  // this code path with status='pending_invite'. Promote them to active
  // before signing the cookie so the cookie payload — and every
  // downstream tier/status check that reads it — sees the post-flip
  // state. If the UPDATE itself fails we still let the sign-in proceed
  // (the row exists, the tier is correct), but we log the failure so an
  // operator can reconcile manually; the next successful login will try
  // again because the status stays at pending_invite.
  if (adminRow.status === 'pending_invite') {
    try {
      const { error: promoteErr } = await getSupabaseAdminClient()
        .from('admins')
        .update({ status: 'active' })
        .eq('id', adminRow.id);
      if (promoteErr) {
        console.warn(
          '[establishAdminSession] pending_invite promotion failed:',
          promoteErr.message,
        );
      } else {
        adminRow = { ...adminRow, status: 'active' };
      }
    } catch (err) {
      console.warn(
        '[establishAdminSession] pending_invite promotion threw:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Best-effort: stamp last_login_at. Don't block the success path on it.
  // Service-role bypasses RLS so the update shouldn't fail in practice,
  // but if it does the admin can still sign in.
  try {
    await getSupabaseAdminClient()
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', adminRow.id);
  } catch (err) {
    console.warn(
      '[establishAdminSession] last_login_at update non-fatal:',
      err instanceof Error ? err.message : err,
    );
  }

  const cookieValue = await signAdminSession({
    sub: adminRow.id,
    email: adminRow.email,
    tier: adminRow.tier,
    status: adminRow.status,
  });

  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });

  return { ok: true, admin: adminRow };
}
