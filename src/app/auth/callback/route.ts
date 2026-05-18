import { NextResponse, type NextRequest } from 'next/server';

import { routing, type Locale } from '@/i18n/routing';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  signAdminSession,
  type AdminStatus,
  type AdminTier,
} from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
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
 * GET /auth/callback?code=<supabase-otp-code>&next=<post-login-path>
 *
 * Magic-link landing handler. Exchanges the Supabase one-time code for a
 * session, looks up the `admins` row by `auth.users.id`, refuses the request
 * if no row exists or the admin is not `active`, and otherwise signs our
 * HMAC session cookie (5-min admin cache spec; currently 1h — see
 * `lib/auth/session.ts`) and redirects to the requested next URL.
 *
 * Always runs in the Node runtime — the admin Supabase client (service-role)
 * is not Edge-safe. The redirect target IS Edge-cached by Next.
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

  let adminRow: { id: string; email: string; tier: AdminTier; status: AdminStatus } | null = null;
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('admins')
      .select('id, email, tier, status')
      .eq('id', exchange.user.id)
      .maybeSingle();
    if (error) {
      console.error('[auth/callback] admin lookup failed:', error.message);
      await supabase.auth.signOut();
      return loginRedirect(req, locale, 'callbackInvalid');
    }
    if (data) {
      adminRow = data as { id: string; email: string; tier: AdminTier; status: AdminStatus };
    }
  } catch (err) {
    console.error('[auth/callback] admin lookup threw:', err instanceof Error ? err.message : err);
    await supabase.auth.signOut();
    return loginRedirect(req, locale, 'callbackInvalid');
  }

  if (!adminRow || adminRow.status !== 'active') {
    // Authenticated by Supabase but not an active admin — bounce out and
    // tear down the auth.users session so a stale Supabase cookie can't
    // hold a foothold on the site.
    await supabase.auth.signOut();
    return loginRedirect(req, locale, 'notAdmin');
  }

  // Best-effort: stamp last_login_at. Don't block the redirect on its
  // success — RLS bypass via service role means it shouldn't fail, but if
  // it does, the user can still sign in.
  try {
    await getSupabaseAdminClient()
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', adminRow.id);
  } catch (err) {
    console.warn(
      '[auth/callback] last_login_at update non-fatal:',
      err instanceof Error ? err.message : err,
    );
  }

  const cookieValue = await signAdminSession({
    sub: adminRow.id,
    email: adminRow.email,
    tier: adminRow.tier,
    status: adminRow.status,
  });

  const response = NextResponse.redirect(new URL(next, req.url));
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  return response;
}
