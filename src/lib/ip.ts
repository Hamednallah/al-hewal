import 'server-only';

import { createHash } from 'node:crypto';

import { env } from '@/lib/env';

/**
 * IP-handling utilities used by every API route that writes to a
 * `*_hash` column (leads.ip_hash, page_views.visitor_hash).
 *
 * Two non-negotiable invariants from CLAUDE.md / DB review:
 *   1. Raw IPs MUST NEVER hit the database or any log.
 *   2. The hash is salted with a **daily-rotated** secret so two
 *      same-IP requests within the same UTC day produce the same hash
 *      (enables dedup + rate-limiting), but a leaked DB row cannot be
 *      correlated back to a real IP across days.
 *
 * The salt itself is derived from `SUPABASE_SERVICE_ROLE_KEY + UTC date`.
 * The service-role key never leaves the server, so the salt is unknown
 * to anyone with read-only DB access (Supabase Studio analytics,
 * dashboard exports, etc.). At UTC midnight every day a fresh salt
 * kicks in automatically — no cron job required.
 */

const FORWARDED_HEADERS = [
  // Vercel sets this to the original visitor IP (it strips Vercel's own
  // proxy hops). Use it first because it's the most trustworthy value
  // in production.
  'x-vercel-forwarded-for',
  // Cloudflare / generic proxies.
  'cf-connecting-ip',
  'true-client-ip',
  // Standard XFF chain (we take the FIRST entry — the original client).
  'x-forwarded-for',
  // Direct connection (fly.io, bare node).
  'x-real-ip',
] as const;

/**
 * Extract the best-effort client IP from a request's headers. Returns
 * `null` when no header is present (local dev curl, server-internal
 * call, malformed proxy chain).
 *
 * Never throws — if every header is missing or malformed, we return
 * null and let the caller decide whether to skip rate-limiting /
 * skip the hash insert / fall back to a different signal.
 */
export function extractClientIp(headers: Headers): string | null {
  for (const name of FORWARDED_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    // x-forwarded-for is a comma-separated chain; the leftmost entry
    // is the original client. The rest are intermediate proxies and
    // are spoofable from outside our infrastructure.
    const first = raw.split(',')[0]?.trim();
    if (first && first.length > 0) return first;
  }
  return null;
}

/**
 * Daily-rotated salt. Stable for the current UTC day, opaque to any
 * caller who doesn't hold the service-role key.
 *
 * Exported only for the unit tests — production code should use
 * `hashIp` directly so the salt never appears in a route handler.
 */
export function dailySalt(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return createHash('sha256')
    .update(env.SUPABASE_SERVICE_ROLE_KEY)
    .update(':')
    .update(day)
    .digest('hex');
}

/**
 * Hash an IP for safe storage. Returns null for null input so callers
 * can `.ip_hash = hashIp(extractClientIp(headers))` without a guard.
 *
 * The output is a 64-char hex SHA-256 digest — enough collision space
 * to make brute-force reversal infeasible even for the full IPv4 space.
 */
export function hashIp(ip: string | null, now: Date = new Date()): string | null {
  if (!ip) return null;
  return createHash('sha256').update(dailySalt(now)).update(':').update(ip).digest('hex');
}
