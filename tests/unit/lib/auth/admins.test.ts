import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
  }),
}));

const sample = {
  sub: '00000000-0000-4000-8000-000000000def',
  email: 'helper-test@al-hewal.sa',
  tier: 'standard_admin' as const,
  status: 'active' as const,
};

describe('currentAdmin / requireAdmin', () => {
  beforeEach(() => {
    cookieStore.clear();
  });
  afterEach(() => {
    cookieStore.clear();
  });

  it('returns null when no cookie is present', async () => {
    const { currentAdmin } = await import('@/lib/auth/admins');
    expect(await currentAdmin()).toBeNull();
  });

  it('returns the verified admin payload when the cookie is valid', async () => {
    const { ADMIN_SESSION_COOKIE_NAME, signAdminSession } = await import('@/lib/auth/session');
    const { currentAdmin } = await import('@/lib/auth/admins');

    cookieStore.set(ADMIN_SESSION_COOKIE_NAME, await signAdminSession(sample));

    const result = await currentAdmin();
    expect(result?.sub).toBe(sample.sub);
    expect(result?.email).toBe(sample.email);
    expect(result?.tier).toBe(sample.tier);
  });

  it('returns null when the cookie value is garbage', async () => {
    const { ADMIN_SESSION_COOKIE_NAME } = await import('@/lib/auth/session');
    const { currentAdmin } = await import('@/lib/auth/admins');

    cookieStore.set(ADMIN_SESSION_COOKIE_NAME, 'not-a-valid-token');
    expect(await currentAdmin()).toBeNull();
  });

  it('requireAdmin throws when there is no session', async () => {
    const { requireAdmin } = await import('@/lib/auth/admins');
    await expect(requireAdmin()).rejects.toThrow(/no admin session/);
  });

  it('requireAdmin returns the admin payload when authenticated', async () => {
    const { ADMIN_SESSION_COOKIE_NAME, signAdminSession } = await import('@/lib/auth/session');
    const { requireAdmin } = await import('@/lib/auth/admins');

    cookieStore.set(ADMIN_SESSION_COOKIE_NAME, await signAdminSession(sample));
    const result = await requireAdmin();
    expect(result.email).toBe(sample.email);
  });
});
