import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Behaviour we want to lock in:
 *
 *   - `active`         → cookie is signed, admin row not status-mutated.
 *   - `pending_invite` → row is flipped to `active` first, then the cookie
 *                        is signed with `status: 'active'` baked in.
 *   - `deactivated`    → rejected with `notAdmin`, no cookie set.
 *   - missing row      → rejected with `notAdmin`.
 *   - select error     → rejected with `lookupFailed`.
 *
 * `last_login_at` is best-effort and must NEVER cause the success path
 * to fail. We exercise the resilience branch separately.
 */

const cookieSetMock = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    set: (...args: unknown[]) => cookieSetMock(...args),
  }),
}));

type AdminRow = {
  id: string;
  email: string;
  tier: 'super_admin' | 'standard_admin';
  status: 'active' | 'deactivated' | 'pending_invite';
};

type SelectResult = { data: AdminRow | null; error: { message: string } | null };
type UpdateResult = { error: { message: string } | null };

// The query-builder shape we mock matches the chains used in
// establish-session.ts:
//   .from('admins').select(...).eq('id', x).maybeSingle()
//   .from('admins').update(...).eq('id', x)
function makeClient(opts: {
  selectResult: SelectResult;
  promoteResult?: UpdateResult;
  lastLoginResult?: UpdateResult;
  onUpdate?: (patch: Record<string, unknown>) => void;
}) {
  let updateCallIndex = 0;
  return {
    from: vi.fn().mockImplementation((_table: string) => {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue(opts.selectResult),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          opts.onUpdate?.(patch);
          // The first update on the success path is the pending_invite
          // promotion; the second is the last_login_at stamp. Order
          // matters because the production code awaits them sequentially.
          const callIndex = updateCallIndex++;
          return {
            eq: vi
              .fn()
              .mockResolvedValue(
                callIndex === 0 && 'status' in patch
                  ? (opts.promoteResult ?? { error: null })
                  : (opts.lastLoginResult ?? { error: null }),
              ),
          };
        },
      };
    }),
  };
}

const getSupabaseAdminClientMock = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => getSupabaseAdminClientMock(),
}));

const SUPABASE_USER_ID = '00000000-0000-4000-8000-000000000abc';

beforeEach(() => {
  cookieSetMock.mockReset();
  getSupabaseAdminClientMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('establishAdminSession', () => {
  it('signs the cookie and returns ok for an active admin', async () => {
    const row: AdminRow = {
      id: SUPABASE_USER_ID,
      email: 'active@al-hewal.test',
      tier: 'standard_admin',
      status: 'active',
    };
    const updates: Record<string, unknown>[] = [];
    getSupabaseAdminClientMock.mockReturnValue(
      makeClient({
        selectResult: { data: row, error: null },
        onUpdate: (patch) => updates.push(patch),
      }),
    );

    const { establishAdminSession } = await import('@/lib/auth/establish-session');
    const result = await establishAdminSession(SUPABASE_USER_ID);

    expect(result).toEqual({ ok: true, admin: row });
    // No status mutation should run for an already-active admin.
    expect(updates.some((u) => 'status' in u)).toBe(false);
    // last_login_at should be stamped.
    expect(updates.some((u) => 'last_login_at' in u)).toBe(true);
    expect(cookieSetMock).toHaveBeenCalledOnce();
  });

  it('promotes pending_invite to active, signs the cookie with status=active', async () => {
    const inviteRow: AdminRow = {
      id: SUPABASE_USER_ID,
      email: 'invitee@al-hewal.test',
      tier: 'standard_admin',
      status: 'pending_invite',
    };
    const updates: Record<string, unknown>[] = [];
    getSupabaseAdminClientMock.mockReturnValue(
      makeClient({
        selectResult: { data: inviteRow, error: null },
        promoteResult: { error: null },
        onUpdate: (patch) => updates.push(patch),
      }),
    );

    const { establishAdminSession } = await import('@/lib/auth/establish-session');
    const result = await establishAdminSession(SUPABASE_USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.admin.status).toBe('active');
    }
    // First update was the promotion; second was last_login_at.
    expect(updates[0]).toEqual({ status: 'active' });
    expect(updates[1]).toHaveProperty('last_login_at');
    expect(cookieSetMock).toHaveBeenCalledOnce();
  });

  it('still establishes the session if the pending_invite promotion update fails', async () => {
    const inviteRow: AdminRow = {
      id: SUPABASE_USER_ID,
      email: 'invitee@al-hewal.test',
      tier: 'standard_admin',
      status: 'pending_invite',
    };
    getSupabaseAdminClientMock.mockReturnValue(
      makeClient({
        selectResult: { data: inviteRow, error: null },
        promoteResult: { error: { message: 'simulated promotion failure' } },
      }),
    );

    const { establishAdminSession } = await import('@/lib/auth/establish-session');
    const result = await establishAdminSession(SUPABASE_USER_ID);

    expect(result.ok).toBe(true);
    expect(cookieSetMock).toHaveBeenCalledOnce();
  });

  it('rejects a deactivated admin with notAdmin', async () => {
    const row: AdminRow = {
      id: SUPABASE_USER_ID,
      email: 'deactivated@al-hewal.test',
      tier: 'standard_admin',
      status: 'deactivated',
    };
    getSupabaseAdminClientMock.mockReturnValue(
      makeClient({ selectResult: { data: row, error: null } }),
    );

    const { establishAdminSession } = await import('@/lib/auth/establish-session');
    const result = await establishAdminSession(SUPABASE_USER_ID);

    expect(result).toEqual({ ok: false, reason: 'notAdmin' });
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it('rejects when no admin row exists for the supabase user', async () => {
    getSupabaseAdminClientMock.mockReturnValue(
      makeClient({ selectResult: { data: null, error: null } }),
    );

    const { establishAdminSession } = await import('@/lib/auth/establish-session');
    const result = await establishAdminSession(SUPABASE_USER_ID);

    expect(result).toEqual({ ok: false, reason: 'notAdmin' });
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it('rejects with lookupFailed when the admin select errors', async () => {
    getSupabaseAdminClientMock.mockReturnValue(
      makeClient({
        selectResult: { data: null, error: { message: 'simulated select failure' } },
      }),
    );

    const { establishAdminSession } = await import('@/lib/auth/establish-session');
    const result = await establishAdminSession(SUPABASE_USER_ID);

    expect(result).toEqual({ ok: false, reason: 'lookupFailed' });
    expect(cookieSetMock).not.toHaveBeenCalled();
  });
});
