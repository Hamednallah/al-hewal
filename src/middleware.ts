import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSession } from '@/lib/auth/session';

/**
 * Root middleware.
 *
 * Two responsibilities, in this order:
 *
 *  1. Admin guard — any path matching `/<locale>/admin(/...)` requires a
 *     valid HMAC-signed session cookie issued by `/auth/callback`. Missing
 *     or expired cookies redirect to `/<locale>/auth/login?next=<path>`
 *     so the user lands on the page they intended after re-auth.
 *
 *  2. next-intl locale negotiator — handles the `/` → `/ar` redirect and
 *     the path-preserving locale switching for everything else.
 *
 * Edge-runtime safe. The cookie verifier uses Web Crypto only (no Node
 * `crypto` / `Buffer`), so this stays in the default Edge runtime.
 *
 * `/auth/callback` and `/auth/sign-out` are deliberately EXCLUDED from
 * the matcher: the magic-link callback URL is registered with Supabase
 * as `${SITE_URL}/auth/callback`, and rewriting it under a locale prefix
 * would break the Supabase config.
 */

const intlMiddleware = createIntlMiddleware(routing);

// Matches the locale-prefixed admin tree AFTER next-intl normalization.
// Bare `/admin` slips through this and falls into the next-intl branch,
// which adds the default-locale prefix; the user's browser then follows
// the redirect and the second hop trips this matcher.
const LOCALE_ADMIN_PATH_RE = /^\/(ar|en)\/admin(?:\/|$)/;

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const adminMatch = LOCALE_ADMIN_PATH_RE.exec(pathname);

  if (adminMatch) {
    const locale = adminMatch[1] as 'ar' | 'en';
    const cookieValue = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    const payload = await verifyAdminSession(cookieValue);

    if (!payload || payload.status !== 'active') {
      const loginUrl = new URL(`/${locale}/auth/login`, req.url);
      loginUrl.searchParams.set('next', pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  // Match every route EXCEPT Next internals, Vercel internals, static
  // files with a dot in the last path segment, the API tree (it does its
  // own auth at the route handler), and the unprefixed /auth tree
  // (callback + sign-out — both register with Supabase as fixed paths
  // that MUST NOT be locale-rewritten).
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
