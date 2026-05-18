'use server';

import { z } from 'zod';

import { env } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const FormSchema = z.object({
  email: z.string().trim().email().max(254),
  next: z.string().max(500).optional(),
});

export type LoginErrorKey = 'invalidEmail' | 'rateLimited' | 'supabase';

export type LoginState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; errorKey: LoginErrorKey };

const INITIAL_NEXT_FALLBACK = '/admin';

/**
 * Server action backing the admin magic-link form.
 *
 * Email-enumeration hardening: we ALWAYS return `{ status: 'sent' }` after a
 * successful syntactic validation, regardless of whether Supabase Auth
 * accepted the email. That hides the "is this address a registered admin?"
 * signal from drive-by probes. Real Supabase errors are logged server-side
 * (visible in Vercel Logs) but never surfaced to the form.
 *
 * `shouldCreateUser: false` prevents Supabase from silently creating an
 * `auth.users` row for an arbitrary email — admin onboarding is invite-only
 * (super_admin → admin_invites → magic-link to a known address).
 */
export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = FormSchema.safeParse({
    email: formData.get('email'),
    next: formData.get('next') ?? undefined,
  });

  if (!parsed.success) {
    return { status: 'error', errorKey: 'invalidEmail' };
  }

  const next = parsed.data.next ?? INITIAL_NEXT_FALLBACK;
  const callbackUrl = new URL('/auth/callback', env.NEXT_PUBLIC_SITE_URL);
  callbackUrl.searchParams.set('next', next);

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: false,
      },
    });

    if (error) {
      // Email-enumeration hardening: log server-side but do not surface to
      // the user. They see "check your inbox" either way; only a registered
      // admin will actually receive a working link.
      console.warn(
        '[auth/login] signInWithOtp non-fatal:',
        error.message,
        'for',
        parsed.data.email.replace(/(.{2}).+(@.+)/, '$1***$2'),
      );
    }
  } catch (err) {
    console.error('[auth/login] signInWithOtp threw:', err instanceof Error ? err.message : err);
    return { status: 'error', errorKey: 'supabase' };
  }

  return { status: 'sent', email: parsed.data.email };
}
