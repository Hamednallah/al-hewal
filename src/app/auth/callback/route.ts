import { NextResponse, type NextRequest } from 'next/server';

import { routing, type Locale } from '@/i18n/routing';
import { establishAdminSession } from '@/lib/auth/establish-session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LOCALE_PREFIX_RE = /^\/(ar|en)(?:\/|$)/;

function resolveLocale(next: string | null): Locale {
  const match = next ? LOCALE_PREFIX_RE.exec(next) : null;
  return (match?.[1] as Locale | undefined) ?? routing.defaultLocale;
}

function safeNext(value: string | null, locale: Locale): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return `/${locale}/admin`;
  }
  return value;
}

function loginRedirect(req: NextRequest, locale: Locale, error: string) {
  const url = new URL(`/${locale}/auth/login`, req.url);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}

/**
 * GET /auth/callback?code=<supabase-code>&next=<post-login-path>
 *
 * Legacy magic-link landing handler. The primary admin auth flow is
 * email + password (`/<locale>/auth/login`) and the password-reset flow
 * goes directly to `/<locale>/auth/reset-password?code=...` (configured
 * in `resetPasswordForEmail`'s `redirectTo`). This route remains so
 * any pre-existing magic-link emails out in the wild still resolve to
 * a working session.
 *
 * Delegates session establishment to `establishAdminSession` so the
 * admin lookup + tier/status gate + HMAC cookie sign + last_login_at
 * stamp can't drift from the password-login server action.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next');
  const locale = resolveLocale(nextParam);
  const next = safeNext(nextParam, locale);

  if (!code) {
    return loginRedirect(req, locale, 'callbackInvalid');
  }

  const supabase = await createSupabaseServerClient();
  const { data: exchange, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !exchange?.user) {
    console.warn('[auth/callback] exchange failed:', exchangeError?.message ?? 'no user');
    return loginRedirect(req, locale, 'callbackExpired');
  }

  const session = await establishAdminSession(exchange.user.id);
  if (!session.ok) {
    // Authenticated by Supabase but not an active admin — tear down
    // the Supabase session so a stale cookie can't hold a foothold.
    await supabase.auth.signOut();
    return loginRedirect(
      req,
      locale,
      session.reason === 'notAdmin' ? 'notAdmin' : 'callbackInvalid',
    );
  }

  return NextResponse.redirect(new URL(next, req.url));
}
