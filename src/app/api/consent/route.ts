import { NextResponse, type NextRequest } from 'next/server';

/**
 * POST /api/consent — record that the visitor has acknowledged the
 * KSA PDPL consent banner. Sets the `alh_consent=v1` cookie so the
 * banner does not re-appear on subsequent requests.
 *
 * The cookie is HTTP-only + lax + 1-year — same shape as the
 * `_alh_v` visitor cookie set by `/api/track/view`. Both cookies
 * are "essential" under the KSA PDPL bracket — they enable the
 * site's basic state-keeping, not analytics tracking.
 *
 * Same-origin guard: refuse POSTs whose `Origin` header does not
 * match `NEXT_PUBLIC_SITE_URL`. Mirrors the existing `/api/leads`
 * pattern.
 */

const COOKIE_NAME = 'alh_consent';
const COOKIE_VALUE = 'v1';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) {
    // Same-origin POSTs from server actions / browsers without
    // an Origin header (some older agents) still set Referer.
    const referer = req.headers.get('referer');
    if (!referer) return false;
    try {
      const refUrl = new URL(referer);
      const expected = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
      return refUrl.origin === new URL(expected).origin;
    } catch {
      return false;
    }
  }
  const expected = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ success: false, error: 'cross_origin' }, { status: 403 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}

export const CONSENT_COOKIE_NAME = COOKIE_NAME;
export const CONSENT_COOKIE_VALUE = COOKIE_VALUE;
