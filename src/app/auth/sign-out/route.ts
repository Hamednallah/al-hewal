import { NextResponse, type NextRequest } from 'next/server';

import { routing, type Locale } from '@/i18n/routing';
import { ADMIN_SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LOCALE_PREFIX_RE = /^\/(ar|en)(?:\/|$)/;

function resolveLocale(next: string | null, referer: string | null): Locale {
  const fromNext = next ? LOCALE_PREFIX_RE.exec(next)?.[1] : null;
  if (fromNext === 'ar' || fromNext === 'en') return fromNext;
  if (referer) {
    try {
      const fromReferer = LOCALE_PREFIX_RE.exec(new URL(referer).pathname)?.[1];
      if (fromReferer === 'ar' || fromReferer === 'en') return fromReferer;
    } catch {
      /* ignore malformed referer */
    }
  }
  return routing.defaultLocale;
}

async function signOut(req: NextRequest) {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get('next');
  const locale = resolveLocale(nextParam, req.headers.get('referer'));

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn(
      '[auth/sign-out] supabase signOut non-fatal:',
      err instanceof Error ? err.message : err,
    );
  }

  const response = NextResponse.redirect(new URL(`/${locale}/auth/login`, req.url));
  response.cookies.delete(ADMIN_SESSION_COOKIE_NAME);
  return response;
}

/**
 * Both GET and POST sign-out work, because the admin shell wants to render
 * the "Sign Out" affordance as a plain `<a>` (zero JS, works without a
 * client form), AND server actions may want to POST to it.
 */
export async function GET(req: NextRequest) {
  return signOut(req);
}

export async function POST(req: NextRequest) {
  return signOut(req);
}
