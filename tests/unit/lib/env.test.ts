import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SITE_URL: 'https://al-hewal.test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghij.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x'.repeat(40),
  SUPABASE_SERVICE_ROLE_KEY: 'y'.repeat(40),
  NEXT_PUBLIC_WHATSAPP_PHONE: '9665XXXXXXXX'.replace(/X/g, '1'),
  // Intentionally NOT matching the AIza... shape so the pre-commit
  // secret-scan does not flag this test fixture as a real key leak.
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'FAKE_MAPS_KEY_FOR_TESTS_NOT_REAL',
};

describe('env loader', () => {
  const originalEnv: NodeJS.ProcessEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, VALID_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(VALID_ENV)) {
      if (key in originalEnv) {
        (process.env as Record<string, string | undefined>)[key] = originalEnv[key];
      } else {
        delete (process.env as Record<string, string | undefined>)[key];
      }
    }
  });

  it('parses a valid environment lazily', async () => {
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://abcdefghij.supabase.co');
    expect(env.NEXT_PUBLIC_WHATSAPP_PHONE).toBe('966511111111');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { env } = await import('@/lib/env');
    expect(() => env.NEXT_PUBLIC_SUPABASE_URL).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejects a malformed WhatsApp phone (E.164 digits required, no +)', async () => {
    process.env.NEXT_PUBLIC_WHATSAPP_PHONE = '+9665XXXXXXXX';
    const { env } = await import('@/lib/env');
    expect(() => env.NEXT_PUBLIC_WHATSAPP_PHONE).toThrowError(/NEXT_PUBLIC_WHATSAPP_PHONE/);
  });

  it('rejects a non-URL site URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'not-a-url';
    const { env } = await import('@/lib/env');
    expect(() => env.NEXT_PUBLIC_SITE_URL).toThrowError(/NEXT_PUBLIC_SITE_URL/);
  });

  it('lists every failing key in the error message', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { env } = await import('@/lib/env');
    try {
      // Force evaluation.
      void env.NEXT_PUBLIC_SUPABASE_URL;
      throw new Error('expected proxy to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const message = (err as Error).message;
      expect(message).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(message).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
  });
});
