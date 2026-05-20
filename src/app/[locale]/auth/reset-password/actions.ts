'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { establishAdminSession } from '@/lib/auth/establish-session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const FormSchema = z.object({
  password: z.string().min(8).max(200),
  confirm: z.string().min(8).max(200),
  locale: z.enum(['ar', 'en']),
});

export type ResetErrorKey =
  | 'invalidInput'
  | 'mismatch'
  | 'expiredSession'
  | 'notAdmin'
  | 'samePassword'
  | 'supabase';

export type ResetState = { status: 'idle' } | { status: 'error'; errorKey: ResetErrorKey };

/**
 * Server action for the "set new password" form.
 *
 * Precondition: the user is signed in to Supabase Auth via the
 * recovery-code exchange that ran in
 * `/<locale>/auth/reset-password/page.tsx`. If the session isn't
 * present (e.g. the user re-loaded after the cookie expired) we surface
 * `expiredSession` and the page sends them back to /auth/forgot.
 *
 * Successful path:
 *   1. Zod-parse + match the two password fields.
 *   2. `supabase.auth.updateUser({ password })`.
 *   3. `establishAdminSession(user.id)` — same admin gate as login.
 *   4. `redirect('/admin')`.
 */
export async function setNewPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = FormSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
    locale: formData.get('locale'),
  });

  if (!parsed.success) {
    return { status: 'error', errorKey: 'invalidInput' };
  }

  if (parsed.data.password !== parsed.data.confirm) {
    return { status: 'error', errorKey: 'mismatch' };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: userBefore } = await supabase.auth.getUser();
    if (!userBefore?.user) {
      return { status: 'error', errorKey: 'expiredSession' };
    }

    const { data: updated, error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (updateError || !updated?.user) {
      const msg = updateError?.message ?? 'no user returned';
      console.warn('[auth/reset-password] updateUser failed:', msg);
      // Supabase Auth returns 422 with message "New password should be
      // different from the old password." (newer versions also set
      // code='same_password') when the submitted password matches the
      // current one. The previous behaviour mapped this to the generic
      // `supabase` copy ("We couldn't save…") which doesn't tell the
      // user what to fix. Detect by message OR code so older + newer
      // GoTrue versions both surface the actionable error.
      const code = (updateError as { code?: string } | null)?.code;
      if (code === 'same_password' || /different from the old password/i.test(msg)) {
        return { status: 'error', errorKey: 'samePassword' };
      }
      return { status: 'error', errorKey: 'supabase' };
    }

    const session = await establishAdminSession(updated.user.id);
    if (!session.ok) {
      await supabase.auth.signOut();
      return {
        status: 'error',
        errorKey:
          session.reason === 'notAdmin' || session.reason === 'promotionFailed'
            ? 'notAdmin'
            : 'supabase',
      };
    }
  } catch (err) {
    console.error(
      '[auth/reset-password] setNewPassword threw:',
      err instanceof Error ? err.message : err,
    );
    return { status: 'error', errorKey: 'supabase' };
  }

  redirect(`/${parsed.data.locale}/admin`);
}
