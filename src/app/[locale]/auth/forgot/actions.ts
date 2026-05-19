'use server';

import { z } from 'zod';

import { env } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const FormSchema = z.object({
  email: z.string().trim().email().max(254),
  locale: z.enum(['ar', 'en']),
});

export type ForgotErrorKey = 'invalidEmail' | 'supabase';

export type ForgotState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; errorKey: ForgotErrorKey };

/**
 * Server action backing the forgot-password form.
 *
 * Email-enumeration hardening: ALWAYS returns `{ status: 'sent' }` after
 * a successful syntactic validation, regardless of whether Supabase
 * accepted the email or not. That hides "is this address a registered
 * admin?" from probes; only a real admin's inbox will see the link.
 *
 * Supabase's recovery email link drops the user on
 * `/<locale>/auth/reset-password?code=...` (the redirectTo URL).
 * That route exchanges the code into a session and renders the
 * "set new password" form.
 *
 * The redirectTo MUST be locale-aware so the post-reset chrome
 * matches the language the admin requested the reset in.
 */
export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = FormSchema.safeParse({
    email: formData.get('email'),
    locale: formData.get('locale'),
  });

  if (!parsed.success) {
    return { status: 'error', errorKey: 'invalidEmail' };
  }

  const redirectTo = new URL(
    `/${parsed.data.locale}/auth/reset-password`,
    env.NEXT_PUBLIC_SITE_URL,
  );

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: redirectTo.toString(),
    });
    if (error) {
      // Email-enumeration hardening: log server-side, surface "sent" anyway.
      console.warn(
        '[auth/forgot] resetPasswordForEmail non-fatal:',
        error.message,
        'for',
        parsed.data.email.replace(/(.{2}).+(@.+)/, '$1***$2'),
      );
    }
  } catch (err) {
    console.error(
      '[auth/forgot] resetPasswordForEmail threw:',
      err instanceof Error ? err.message : err,
    );
    return { status: 'error', errorKey: 'supabase' };
  }

  return { status: 'sent', email: parsed.data.email };
}
