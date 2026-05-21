'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { currentAdmin } from '@/lib/auth/admins';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Server actions for the admin My Profile page. Two flows:
 *
 *   - `changeEmail`     → `supabase.auth.updateUser({ email })`. Supabase
 *                         emails a confirmation link to the NEW address;
 *                         sign-in stays on the old address until the
 *                         user clicks that link. We surface the
 *                         "check your new inbox" message in the form.
 *
 *   - `changePassword`  → `supabase.auth.updateUser({ password })`. Same
 *                         plumbing as `/auth/reset-password`'s
 *                         setNewPassword, but the user is already in a
 *                         live session (signed in via the admin cookie
 *                         + Supabase auth cookie); no need to call
 *                         establishAdminSession again.
 *
 * Both actions REQUIRE an authenticated admin context. They re-check
 * `currentAdmin()` defensively even though middleware already gated
 * the page — RSC + server-action paths can drift from middleware
 * routing in subtle ways (e.g. middleware matcher patterns).
 */

const EmailSchema = z.object({
  email: z.string().email().max(254),
});

const PasswordSchema = z.object({
  password: z.string().min(8).max(200),
  confirm: z.string().min(8).max(200),
});

export type ChangeEmailErrorKey =
  | 'invalidInput'
  | 'sameEmail'
  | 'rateLimited'
  | 'notAuthenticated'
  | 'supabase';

export type ChangeEmailState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; errorKey: ChangeEmailErrorKey };

export async function changeEmail(
  _prev: ChangeEmailState,
  formData: FormData,
): Promise<ChangeEmailState> {
  const parsed = EmailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { status: 'error', errorKey: 'invalidInput' };
  }

  const admin = await currentAdmin();
  if (!admin) {
    return { status: 'error', errorKey: 'notAuthenticated' };
  }
  if (parsed.data.email.toLowerCase() === admin.email.toLowerCase()) {
    return { status: 'error', errorKey: 'sameEmail' };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
    if (error) {
      console.warn('[admin/profile] changeEmail failed:', error.message);
      const code = (error as { code?: string } | null)?.code;
      const status = (error as { status?: number } | null)?.status;
      if (status === 429 || code === 'over_email_send_rate_limit') {
        return { status: 'error', errorKey: 'rateLimited' };
      }
      return { status: 'error', errorKey: 'supabase' };
    }
  } catch (err) {
    console.error('[admin/profile] changeEmail threw:', err instanceof Error ? err.message : err);
    return { status: 'error', errorKey: 'supabase' };
  }

  // Email isn't actually live until the user confirms via the link.
  // No revalidate needed — the admin cookie still reflects the OLD
  // email and will until the next login.
  return { status: 'success' };
}

export type ChangePasswordErrorKey =
  | 'invalidInput'
  | 'mismatch'
  | 'tooShort'
  | 'samePassword'
  | 'notAuthenticated'
  | 'supabase';

export type ChangePasswordState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; errorKey: ChangePasswordErrorKey };

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = PasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });

  if (!parsed.success) {
    // Distinguish "too short" so the UI gives an actionable hint.
    const tooShort = parsed.error.issues.some(
      (i) => i.code === 'too_small' && i.path.includes('password'),
    );
    return {
      status: 'error',
      errorKey: tooShort ? 'tooShort' : 'invalidInput',
    };
  }

  if (parsed.data.password !== parsed.data.confirm) {
    return { status: 'error', errorKey: 'mismatch' };
  }

  const admin = await currentAdmin();
  if (!admin) {
    return { status: 'error', errorKey: 'notAuthenticated' };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      console.warn('[admin/profile] changePassword failed:', error.message);
      const code = (error as { code?: string } | null)?.code;
      const msg = error.message;
      if (code === 'same_password' || /different from the old password/i.test(msg)) {
        return { status: 'error', errorKey: 'samePassword' };
      }
      return { status: 'error', errorKey: 'supabase' };
    }
  } catch (err) {
    console.error(
      '[admin/profile] changePassword threw:',
      err instanceof Error ? err.message : err,
    );
    return { status: 'error', errorKey: 'supabase' };
  }

  // Revalidate the profile page so any session-state surface updates.
  revalidatePath('/admin/profile');
  return { status: 'success' };
}
