'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { establishAdminSession } from '@/lib/auth/establish-session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const FormSchema = z.object({
  email: z.string().trim().email().max(254),
  // Supabase enforces 6-char minimum on its side; we mirror that here to
  // give the user a clear front-end error instead of relying on a
  // round-trip.
  password: z.string().min(6).max(200),
  next: z.string().max(500).optional(),
});

export type LoginErrorKey = 'invalidInput' | 'wrongCredentials' | 'notAdmin' | 'supabase';

export type LoginState = { status: 'idle' } | { status: 'error'; errorKey: LoginErrorKey };

const NEXT_FALLBACK = '/admin';

/**
 * Server action backing the admin email + password login form.
 *
 * Replaces the magic-link OTP flow from PR 3.1 — Supabase's built-in
 * SMTP proved unreliable on the Hobby tier (rate-limited + intermittent
 * delivery), and admins log in often enough that depending on email
 * per-login was the wrong default.
 *
 * Flow:
 *   1. Zod-parse email + password.
 *   2. `supabase.auth.signInWithPassword` against Supabase Auth.
 *   3. On success, hand the `auth.users.id` to `establishAdminSession`
 *      which gates on `public.admins.status='active'` and signs our
 *      HMAC cookie.
 *   4. `redirect(next)` — must be OUTSIDE the try-catch because
 *      `redirect()` works by throwing a special Next sentinel.
 *
 * No email-enumeration hardening this time: `wrongCredentials` covers
 * both "no such account" and "wrong password", so the form doesn't
 * leak which one. (signInWithPassword returns the same Supabase error
 * for both cases.)
 *
 * Password reset still depends on email — that's the `/auth/forgot`
 * flow. But the per-login dependency is gone.
 */
export async function signInWithEmailPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = FormSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });

  if (!parsed.success) {
    return { status: 'error', errorKey: 'invalidInput' };
  }

  const next = safeNext(parsed.data.next);

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      // Don't differentiate "wrong password" vs "no such email" — the
      // login form treats both as the same `wrongCredentials` so we
      // don't leak which addresses are registered.
      return { status: 'error', errorKey: 'wrongCredentials' };
    }

    const session = await establishAdminSession(data.user.id);
    if (!session.ok) {
      // Authenticated by Supabase but not an active admin — sign out
      // of Supabase so a stale auth.users session doesn't linger.
      await supabase.auth.signOut();
      return {
        status: 'error',
        errorKey: session.reason === 'notAdmin' ? 'notAdmin' : 'supabase',
      };
    }
  } catch (err) {
    console.error(
      '[auth/login] signInWithPassword threw:',
      err instanceof Error ? err.message : err,
    );
    return { status: 'error', errorKey: 'supabase' };
  }

  // Must be OUTSIDE the try/catch — redirect() throws a Next sentinel
  // that the framework intercepts to perform the navigation.
  redirect(next);
}

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return NEXT_FALLBACK;
  }
  return value;
}
