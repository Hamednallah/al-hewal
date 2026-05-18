import 'server-only';

import { cookies } from 'next/headers';

import { ADMIN_SESSION_COOKIE_NAME, type AdminSessionPayload, verifyAdminSession } from './session';

/**
 * Read-only admin helper for React Server Components and Server Actions.
 *
 * Returns the admin's identity + tier when the request carries a valid,
 * unexpired session cookie that middleware just verified. Returns `null`
 * for unauthenticated requests — RSCs MUST handle that case explicitly
 * (typically by calling `notFound()` or redirecting), because relying on
 * middleware alone is brittle: an RSC may be rendered for a path the
 * middleware matcher doesn't cover.
 *
 * Does NOT call Supabase. The Supabase round-trip happens once, in the
 * `/auth/callback` route handler, which is where the cookie is first
 * signed. After that, middleware + this helper run on the signed payload
 * for the cookie's lifetime.
 */
export async function currentAdmin(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  const value = store.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return verifyAdminSession(value);
}

/**
 * Same as `currentAdmin()`, but throws if not authenticated. Useful in
 * admin-only RSCs/actions where reaching the call without a session is a
 * programming error (the middleware should have already redirected).
 */
export async function requireAdmin(): Promise<AdminSessionPayload> {
  const admin = await currentAdmin();
  if (!admin) {
    throw new Error('requireAdmin: no admin session — middleware should have intercepted');
  }
  return admin;
}
