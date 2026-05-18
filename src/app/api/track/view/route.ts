import { createHash, randomBytes } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { dailySalt, extractClientIp, hashIp } from '@/lib/ip';
import { viewTrackerLimiter } from '@/lib/ratelimit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/track/view
 *
 * Bumps page_views. Designed to be called via `navigator.sendBeacon`
 * from a client effect so it survives navigation. The request body is
 * a small JSON blob describing the page; the response is always 204
 * (no content) — sendBeacon ignores responses and we don't want to
 * waste bytes on a body the caller won't read.
 *
 * visitor_hash strategy:
 *   - A `_alh_v` cookie is issued on first visit (random 16-byte hex).
 *   - That cookie value is hashed with the daily-rotated salt and
 *     stored as visitor_hash. Same visitor + same day → same hash;
 *     across days the hash rotates so cross-day correlation requires
 *     the rotating salt, which lives only in env.
 *   - When the cookie is missing (first visit), we hash the IP as a
 *     short-lived fallback so first-page-view dedup still works for
 *     scrapers that don't accept Set-Cookie.
 *
 * Per-visitor rate-limit (60/min). A page view above that rate is a
 * bot — we drop the row silently rather than expanding the analytics
 * table with junk.
 */

const BodySchema = z.object({
  path: z.string().min(1).max(2048),
  locale: z.enum(['ar', 'en']),
  propertyId: z.string().uuid().optional(),
});

const COOKIE_NAME = '_alh_v';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    // Malformed body — accept silently to avoid client retry storms.
    return new NextResponse(null, { status: 204 });
  }

  const ip = extractClientIp(req.headers);

  // Cookie-or-IP for the visitor identity. New cookie issued in the
  // response when missing — subsequent views will dedup via the cookie.
  const existingCookie = req.cookies.get(COOKIE_NAME)?.value;
  const visitorSeed = existingCookie ?? ip ?? '';
  const issuingCookie = !existingCookie ? randomBytes(16).toString('hex') : null;

  // Rate-limit by visitor seed (falls back to IP, then a single shared
  // bucket if both are missing — the shared bucket is essentially a
  // global throttle that only matters for truly anonymous requests).
  const rateLimitId = visitorSeed || 'anon';
  try {
    const { success } = await viewTrackerLimiter().limit(rateLimitId);
    if (!success) {
      return respondWithCookie(issuingCookie);
    }
  } catch (err) {
    console.warn(
      '[track/view] ratelimit check failed (recording anyway):',
      err instanceof Error ? err.message : err,
    );
  }

  const visitorHash = visitorSeed
    ? createHash('sha256').update(dailySalt()).update(':').update(visitorSeed).digest('hex')
    : null;
  const ipHash = hashIp(ip);

  try {
    const client = getSupabaseAdminClient();
    const viewRow = {
      path: parsed.data.path,
      property_id: parsed.data.propertyId ?? null,
      locale: parsed.data.locale,
      // Prefer the cookie-seeded hash; if neither cookie nor IP was
      // available, fall back to the IP hash (which itself may be null
      // for truly stateless callers — RLS doesn't require it).
      visitor_hash: visitorHash ?? ipHash ?? 'anon',
    };
    const { error } = await client.from('page_views').insert(viewRow);
    if (error) {
      console.warn('[track/view] insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[track/view] unexpected DB failure:', err instanceof Error ? err.message : err);
  }

  return respondWithCookie(issuingCookie);
}

function respondWithCookie(issuingCookie: string | null): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  if (issuingCookie) {
    res.cookies.set(COOKIE_NAME, issuingCookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
  }
  return res;
}
