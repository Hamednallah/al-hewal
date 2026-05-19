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
 * magic-link / recovery callback, and (later) the invite-acceptance
 * flow. Centralises the admin row lookup + tier/status gate + HMAC
 * cookie sign + last_login_at stamp so the rules can't drift across
 * callers.
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

  if (!adminRow || adminRow.status !== 'active') {
    return { ok: false, reason: 'notAdmin' };
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
