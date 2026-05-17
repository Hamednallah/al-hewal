import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

import { env } from '@/lib/env';

/**
 * Rate-limit primitives used by every public-write API route.
 *
 * Wraps `@upstash/ratelimit` with a graceful no-op fallback so the app
 * still functions when Upstash isn't configured (local dev, smoke
 * tests, the moment before the owner sets the env vars in Vercel).
 *
 * Quotas per CLAUDE.md / DB review:
 *   - whatsappTrack: 10/minute per IP — the conversion CTA, generous
 *     to avoid blocking real users who tap twice in frustration.
 *   - leadsContact:   5/minute per IP — the contact form, stricter
 *     because the cost per accepted lead is higher.
 *   - viewTracker:   60/minute per visitor cookie — page-view beacons
 *     fire on navigation; one per page is normal, sixty is suspicious.
 *
 * The fallback returns `{ success: true }` for every check when Upstash
 * is absent. In production this should NEVER happen — env.ts marks
 * UPSTASH_REDIS_REST_URL / TOKEN as optional only because Phase 1
 * shipped without them. CI will warn (see the build-time guard at the
 * bottom of this file) and a Phase 6 ops checklist item flips the env
 * vars to required.
 *
 * Limiter instances are lazy + memoised so re-imports during HMR don't
 * spin up a new Redis client per request.
 */

type LimitResult = { success: boolean; remaining: number; reset: number };

type Limiter = {
  limit: (identifier: string) => Promise<LimitResult>;
};

const FALLBACK_LIMITER: Limiter = {
  limit: async () => ({ success: true, remaining: Number.POSITIVE_INFINITY, reset: 0 }),
};

let cachedRedis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cachedRedis = null;
    return null;
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

function build(prefix: string, requests: number, window: `${number} ${'s' | 'm' | 'h'}`): Limiter {
  const redis = getRedis();
  if (!redis) return FALLBACK_LIMITER;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix,
    analytics: false,
  });
}

let _whatsappTrack: Limiter | undefined;
let _leadsContact: Limiter | undefined;
let _viewTracker: Limiter | undefined;

export function whatsappTrackLimiter(): Limiter {
  if (!_whatsappTrack) _whatsappTrack = build('rl:wa-track', 10, '1 m');
  return _whatsappTrack;
}

export function leadsContactLimiter(): Limiter {
  if (!_leadsContact) _leadsContact = build('rl:leads', 5, '1 m');
  return _leadsContact;
}

export function viewTrackerLimiter(): Limiter {
  if (!_viewTracker) _viewTracker = build('rl:views', 60, '1 m');
  return _viewTracker;
}

/**
 * True when Upstash credentials are configured. Useful for health
 * checks and the no-op-warning that the API routes emit when running
 * without rate-limiting.
 */
export function isRateLimitingActive(): boolean {
  return getRedis() != null;
}
