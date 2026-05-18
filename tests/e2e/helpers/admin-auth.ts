import type { BrowserContext } from '@playwright/test';

/**
 * Playwright helper that simulates a signed-in admin by injecting a valid
 * `alh_admin_sess` cookie into the browser context BEFORE navigation.
 *
 * Why we duplicate the signing logic instead of importing
 * `@/lib/auth/session`:
 *   - `session.ts` imports `@/lib/env`, which is wrapped in `server-only`
 *     and a Zod Proxy that throws on first access if a required env var
 *     is missing. The Playwright test process doesn't load `.env`, so
 *     reaching into that module from here would force every dev to run
 *     tests with the secret pre-exported.
 *   - The cookie format is small and frozen by the production code — the
 *     server's verify is the authoritative side. If you change the format
 *     in `session.ts`, update this helper to match (and the vitest unit
 *     tests for `session.ts` will catch any payload-shape drift).
 *
 * The secret falls back to the same deterministic test value the CI
 * workflow + `tests/setup.ts` pin, so the cookie verifies on both
 * locally-launched dev servers (`.env`) and the CI Playwright job.
 */

const ADMIN_SESSION_COOKIE_NAME = 'alh_admin_sess';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60;
const DEFAULT_BASE = 'http://localhost:3000';
const TEST_SECRET_FALLBACK = 'test-only-deterministic-cookie-secret-32+chars-for-ci';

export type AdminTier = 'super_admin' | 'standard_admin';
export type AdminStatus = 'active' | 'deactivated' | 'pending_invite';

export interface AdminFixture {
  tier?: AdminTier;
  status?: AdminStatus;
  email?: string;
  sub?: string;
  baseURL?: string;
}

function base64UrlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signSession(payload: {
  sub: string;
  email: string;
  tier: AdminTier;
  status: AdminStatus;
}): Promise<string> {
  const secret = process.env.AUTH_COOKIE_SECRET ?? TEST_SECRET_FALLBACK;
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + ADMIN_SESSION_TTL_SECONDS };
  const enc = new TextEncoder();
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(full)));
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  return `${payloadB64}.${base64UrlEncode(signature)}`;
}

export async function loginAsAdmin(
  context: BrowserContext,
  fixture: AdminFixture = {},
): Promise<void> {
  const tier = fixture.tier ?? 'standard_admin';
  const status = fixture.status ?? 'active';
  const email = fixture.email ?? `${tier}@al-hewal.test`;
  const sub =
    fixture.sub ??
    `00000000-0000-4000-8000-${tier === 'super_admin' ? '1' : '2'}aaaaaaaaaaa`.slice(0, 36);
  const baseURL = fixture.baseURL ?? DEFAULT_BASE;

  const cookieValue = await signSession({ sub, email, tier, status });
  const { hostname } = new URL(baseURL);

  await context.addCookies([
    {
      name: ADMIN_SESSION_COOKIE_NAME,
      value: cookieValue,
      domain: hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}
