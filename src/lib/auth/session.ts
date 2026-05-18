import 'server-only';

import { env } from '@/lib/env';

/**
 * Signed admin-session cookie that mirrors the admin's identity + tier so
 * middleware can authorise admin routes without round-tripping to Supabase
 * on every request.
 *
 * TTL = 1 hour, deliberately matched to Supabase Auth's default access-token
 * lifetime. The master-plan spec called for a 5-minute cookie with a
 * middleware refresh hop; the refresh is deferred until usage data shows
 * it's worth the extra middleware → Supabase call (every refresh would cost
 * one function invocation on the free tier). When the cookie expires,
 * middleware bounces the user to `/<locale>/auth/login`, and Supabase Auth's
 * still-valid session usually means the magic-link request is a one-click
 * re-auth.
 *
 * Edge-runtime safe: only uses Web Crypto (`SubtleCrypto`) — no `Buffer`,
 * no `node:crypto`. That keeps Next 15's default middleware runtime
 * working without ejecting to Node.
 *
 * Forgery guard: HMAC-SHA-256 over the base64url-encoded payload using a
 * 32+ char secret from env. A tampered cookie fails the verify step and
 * the request is treated as unauthenticated.
 *
 * Expiry guard: `exp` is embedded in the signed payload and checked on
 * verify, so a stolen-but-not-yet-expired cookie has a one-hour blast
 * radius. Rotating `AUTH_COOKIE_SECRET` invalidates every issued cookie.
 */

export const ADMIN_SESSION_COOKIE_NAME = 'alh_admin_sess';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60;

export type AdminTier = 'super_admin' | 'standard_admin';
export type AdminStatus = 'active' | 'deactivated' | 'pending_invite';

export interface AdminSessionPayload {
  /** auth.users.id — matches public.admins.id */
  sub: string;
  email: string;
  tier: AdminTier;
  status: AdminStatus;
  /** Issued-at, unix seconds */
  iat: number;
  /** Expires-at, unix seconds */
  exp: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + padding);
  // Allocate a concrete ArrayBuffer (not ArrayBufferLike) so the resulting
  // Uint8Array satisfies SubtleCrypto's BufferSource without an unsafe cast.
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return view;
}

async function importHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(env.AUTH_COOKIE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Sign an admin-session payload into a cookie value of the shape
 * `<base64url-json>.<base64url-hmac>`. `iat` + `exp` are stamped here
 * using `ADMIN_SESSION_TTL_SECONDS`.
 */
export async function signAdminSession(
  payload: Pick<AdminSessionPayload, 'sub' | 'email' | 'tier' | 'status'>,
  now: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const full: AdminSessionPayload = {
    ...payload,
    iat: now,
    exp: now + ADMIN_SESSION_TTL_SECONDS,
  };
  const payloadB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(full)));
  const key = await importHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payloadB64));
  return `${payloadB64}.${base64UrlEncode(signature)}`;
}

/**
 * Verify a session cookie. Returns the typed payload on success, or `null`
 * if the cookie is missing, malformed, tampered, or expired.
 *
 * Constant-time signature comparison is delegated to `SubtleCrypto.verify`,
 * which compares securely under the hood.
 */
export async function verifyAdminSession(
  token: string | undefined | null,
  now: number = Math.floor(Date.now() / 1000),
): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const signatureB64 = token.slice(dot + 1);

  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = base64UrlDecode(signatureB64);
  } catch {
    return null;
  }

  const key = await importHmacKey();
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    textEncoder.encode(payloadB64),
  );
  if (!valid) return null;

  let payload: AdminSessionPayload;
  try {
    payload = JSON.parse(textDecoder.decode(base64UrlDecode(payloadB64))) as AdminSessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.exp !== 'number' ||
    typeof payload.iat !== 'number'
  ) {
    return null;
  }

  if (payload.exp <= now) return null;

  return payload;
}
