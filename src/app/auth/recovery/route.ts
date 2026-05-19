import { NextResponse, type NextRequest } from 'next/server';

import { type Locale, routing } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /auth/recovery?code=<supabase-pkce-code>&locale=<ar|en>&type=<invite|reset>
 *
 * Code-exchange landing for the invite + password-recovery flows.
 *
 * Why this exists as a Route Handler (and not on the reset-password
 * Server Component): Next 15 only allows cookie writes from Route
 * Handlers and Server Actions. The page used to call
 * `supabase.auth.exchangeCodeForSession` inside its render —
 * Supabase's SSR adapter tries to call `cookies().set(...)`, Next
 * throws "Cookies can only be modified in a Server Action or Route
 * Handler", and our adapter's `try/catch` silently swallowed the
 * error. The exchange "succeeded" at the Supabase API but the
 * session cookies never persisted. When the user submitted the
 * password form, the server action's `supabase.auth.getUser()`
 * returned null and the page rendered "Your reset session has
 * expired" even though the recovery code was still valid.
 *
 * The Route Handler runs the same exchange but in a context where
 * cookie writes are honoured — the session cookies are persisted and
 * the form action sees the authenticated user on submit.
 *
 * Both Supabase Auth's `inviteUserByEmail` and `resetPasswordForEmail`
 * deliver a `?code=` query parameter on the configured `redirectTo`,
 * so this single handler covers both flows.
 */
type RecoveryType = 'invite' | 'reset';

function isLocale(value: string | null): value is Locale {
  return (routing.locales as readonly string[]).includes(value ?? '');
}

function resolveLocale(value: string | null): Locale {
  return isLocale(value) ? value : routing.defaultLocale;
}

function resolveType(value: string | null): RecoveryType {
  // Default to 'reset' for back-compat with the previous redirectTo
  // shape (PR #34 emails didn't carry `type`). Invite emails from the
  // new flow set `type=invite` explicitly.
  return value === 'invite' ? 'invite' : 'reset';
}

function destinationPath(locale: Locale, type: RecoveryType): string {
  return type === 'invite' ? `/${locale}/auth/set-password` : `/${locale}/auth/reset-password`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const locale = resolveLocale(url.searchParams.get('locale'));
  const type = resolveType(url.searchParams.get('type'));

  if (!code) {
    const forgot = new URL(`/${locale}/auth/forgot`, req.url);
    forgot.searchParams.set('error', 'expired');
    return NextResponse.redirect(forgot);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn('[auth/recovery] code exchange failed:', error.message);
    const forgot = new URL(`/${locale}/auth/forgot`, req.url);
    forgot.searchParams.set('error', 'expired');
    return NextResponse.redirect(forgot);
  }

  // Exchange succeeded — Supabase cookies are now set on this response.
  // Route the user to the right form depending on whether they were
  // invited (first-time set) or recovering a forgotten password.
  return NextResponse.redirect(new URL(destinationPath(locale, type), req.url));
}
