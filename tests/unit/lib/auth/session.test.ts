import { describe, expect, it } from 'vitest';

import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  signAdminSession,
  verifyAdminSession,
} from '@/lib/auth/session';

const SAMPLE = {
  sub: '00000000-0000-4000-8000-000000000abc',
  email: 'owner@al-hewal.sa',
  tier: 'super_admin' as const,
  status: 'active' as const,
};

describe('admin session cookie', () => {
  it('exposes a stable cookie name and 1-hour TTL', () => {
    expect(ADMIN_SESSION_COOKIE_NAME).toBe('alh_admin_sess');
    expect(ADMIN_SESSION_TTL_SECONDS).toBe(3600);
  });

  it('signs and verifies a payload round-trip', async () => {
    const token = await signAdminSession(SAMPLE);
    const payload = await verifyAdminSession(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(SAMPLE.sub);
    expect(payload?.email).toBe(SAMPLE.email);
    expect(payload?.tier).toBe(SAMPLE.tier);
    expect(payload?.status).toBe(SAMPLE.status);
    expect(payload?.exp).toBe(payload!.iat + ADMIN_SESSION_TTL_SECONDS);
  });

  it('rejects a tampered payload', async () => {
    const token = await signAdminSession(SAMPLE);
    // Flip the LAST character of the payload section. Even if the JSON
    // happens to still parse, the signature won't match.
    const [payloadB64, sig] = token.split('.');
    const tampered = payloadB64.slice(0, -1) + (payloadB64.slice(-1) === 'a' ? 'b' : 'a');
    const result = await verifyAdminSession(`${tampered}.${sig}`);
    expect(result).toBeNull();
  });

  it('rejects a tampered signature', async () => {
    const token = await signAdminSession(SAMPLE);
    const [payloadB64, sig] = token.split('.');
    const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a');
    const result = await verifyAdminSession(`${payloadB64}.${tamperedSig}`);
    expect(result).toBeNull();
  });

  it('rejects an expired payload', async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - (ADMIN_SESSION_TTL_SECONDS + 60);
    const token = await signAdminSession(SAMPLE, issuedAt);
    const result = await verifyAdminSession(token);
    expect(result).toBeNull();
  });

  it('accepts a payload that has not yet expired', async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 30;
    const token = await signAdminSession(SAMPLE, issuedAt);
    const result = await verifyAdminSession(token);
    expect(result).not.toBeNull();
  });

  it('rejects malformed cookies', async () => {
    expect(await verifyAdminSession(undefined)).toBeNull();
    expect(await verifyAdminSession(null)).toBeNull();
    expect(await verifyAdminSession('')).toBeNull();
    expect(await verifyAdminSession('not-a-token')).toBeNull();
    expect(await verifyAdminSession('only-one-part.')).toBeNull();
    expect(await verifyAdminSession('.only-signature-part')).toBeNull();
    expect(await verifyAdminSession('!!!invalid-base64!!!.???')).toBeNull();
  });

  it('rejects payloads missing required fields', async () => {
    // Build a payload by hand that lacks `sub`. Sign it with the real key
    // so only the structural check (not the signature) is in play.
    const partial = {
      email: 'x@y',
      tier: 'standard_admin',
      status: 'active',
      iat: 0,
      exp: 9_999_999_999,
    };
    const enc = new TextEncoder();
    const payloadB64 = btoa(JSON.stringify(partial))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(process.env.AUTH_COOKIE_SECRET ?? ''),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(await verifyAdminSession(`${payloadB64}.${sigB64}`)).toBeNull();
  });
});
