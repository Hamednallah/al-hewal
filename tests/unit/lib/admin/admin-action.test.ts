import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/admins', () => ({
  currentAdmin: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/data/admins', () => ({
  getAdminById: vi.fn(),
  updateAdmin: vi.fn(),
}));

import { currentAdmin } from '@/lib/auth/admins';
import { writeAuditLog } from '@/lib/audit';
import { handleAdminAction } from '@/lib/admin/admin-action';
import type { AdminSessionPayload } from '@/lib/auth/session';
import { getAdminById, updateAdmin } from '@/lib/data/admins';

const VALID_UUID = '22222222-2222-7222-8222-222222222222';
const TARGET_UUID = '33333333-3333-7333-8333-333333333333';

function makeAdmin(overrides: Partial<AdminSessionPayload> = {}): AdminSessionPayload {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    sub: VALID_UUID,
    email: 'super@al-hewal.test',
    tier: 'super_admin',
    status: 'active',
    iat: nowSec,
    exp: nowSec + 3600,
    ...overrides,
  };
}

function makeTargetRow(overrides: Partial<Awaited<ReturnType<typeof getAdminById>>> = {}) {
  return {
    id: TARGET_UUID,
    email: 'target@al-hewal.test',
    full_name: 'Target Admin',
    tier: 'standard_admin' as const,
    status: 'active' as const,
    language_pref: 'en' as const,
    last_login_at: null,
    created_at: '2026-05-19T00:00:00Z',
    updated_at: '2026-05-19T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleAdminAction — auth + tier gates', () => {
  it('returns 401 when no admin session exists', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(null);
    const res = await handleAdminAction(TARGET_UUID, {
      auditAction: 'promote',
      update: { tier: 'super_admin' },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, error: 'unauthorized' });
    expect(getAdminById).not.toHaveBeenCalled();
    expect(updateAdmin).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('returns 403 when caller is standard_admin (every admin-management action is super_admin only)', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin({ tier: 'standard_admin' }));
    const res = await handleAdminAction(TARGET_UUID, {
      auditAction: 'promote',
      update: { tier: 'super_admin' },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ success: false, error: 'forbidden' });
    expect(getAdminById).not.toHaveBeenCalled();
    expect(updateAdmin).not.toHaveBeenCalled();
  });
});

describe('handleAdminAction — UUID + self-action + not-found guards', () => {
  it('returns 400 when the id is not a valid UUID', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin());
    const res = await handleAdminAction('not-a-uuid', {
      auditAction: 'promote',
      update: { tier: 'super_admin' },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'invalid_id' });
    expect(getAdminById).not.toHaveBeenCalled();
  });

  it('returns 400 forbidden_self when guardSelfAction is true and caller targets themselves', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin({ sub: VALID_UUID }));
    const res = await handleAdminAction(VALID_UUID, {
      auditAction: 'deactivate',
      update: { status: 'deactivated' },
      guardSelfAction: true,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'forbidden_self' });
    expect(getAdminById).not.toHaveBeenCalled();
    expect(updateAdmin).not.toHaveBeenCalled();
  });

  it('allows self-action when guardSelfAction is false (e.g. reactivate is harmless on self)', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin({ sub: VALID_UUID }));
    vi.mocked(getAdminById).mockResolvedValue(
      makeTargetRow({ id: VALID_UUID, status: 'deactivated' }),
    );
    vi.mocked(updateAdmin).mockResolvedValue(makeTargetRow({ id: VALID_UUID, status: 'active' }));
    const res = await handleAdminAction(VALID_UUID, {
      auditAction: 'deactivate',
      update: { status: 'active' },
    });
    expect(res.status).toBe(200);
    expect(updateAdmin).toHaveBeenCalledOnce();
  });

  it('returns 404 when the target admin id is not found in public.admins', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin());
    vi.mocked(getAdminById).mockResolvedValue(null);
    const res = await handleAdminAction(TARGET_UUID, {
      auditAction: 'promote',
      update: { tier: 'super_admin' },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'not_found' });
    expect(updateAdmin).not.toHaveBeenCalled();
  });
});

describe('handleAdminAction — success path', () => {
  it('runs the update, writes the audit log with before/after, and returns 200', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin());
    vi.mocked(getAdminById).mockResolvedValue(
      makeTargetRow({ tier: 'standard_admin', status: 'active' }),
    );
    vi.mocked(updateAdmin).mockResolvedValue(
      makeTargetRow({ tier: 'super_admin', status: 'active' }),
    );

    const res = await handleAdminAction(TARGET_UUID, {
      auditAction: 'promote',
      update: { tier: 'super_admin' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: TARGET_UUID } });

    expect(updateAdmin).toHaveBeenCalledWith(TARGET_UUID, { tier: 'super_admin' });
    expect(writeAuditLog).toHaveBeenCalledOnce();
    const audited = vi.mocked(writeAuditLog).mock.calls[0]![0];
    expect(audited.actorId).toBe(VALID_UUID);
    expect(audited.action).toBe('promote');
    expect(audited.entity).toBe('admin');
    expect(audited.entityId).toBe(TARGET_UUID);
    expect(audited.diff).toEqual({
      before: { tier: 'standard_admin', status: 'active' },
      after: { tier: 'super_admin', status: 'active' },
    });
  });
});

describe('handleAdminAction — failure path', () => {
  it('audit-logs the scrubbed error and returns 500 when updateAdmin throws', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin());
    vi.mocked(getAdminById).mockResolvedValue(makeTargetRow());
    vi.mocked(updateAdmin).mockRejectedValue(
      new Error('Supabase: row update failed for target@al-hewal.test'),
    );

    const res = await handleAdminAction(TARGET_UUID, {
      auditAction: 'deactivate',
      update: { status: 'deactivated' },
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'mutation_failed' });

    expect(writeAuditLog).toHaveBeenCalledOnce();
    const audited = vi.mocked(writeAuditLog).mock.calls[0]![0];
    expect(audited.action).toBe('deactivate');
    expect(audited.entityId).toBe(TARGET_UUID);
    const diff = audited.diff as { error: string; code: string | null };
    // PII (the email) should be stripped from the recorded diff.
    expect(diff.error).not.toContain('target@al-hewal.test');
    expect(diff.error).toMatch(/row update failed/i);
  });

  it('records the postgres error code when the thrown error carries one', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin());
    vi.mocked(getAdminById).mockResolvedValue(makeTargetRow());
    // Mimic a Supabase PostgrestError — plain object, not Error instance.
    vi.mocked(updateAdmin).mockRejectedValue({
      code: '23505',
      message: 'duplicate key violates admins_email_key',
      details: null,
    } as never);

    const res = await handleAdminAction(TARGET_UUID, {
      auditAction: 'promote',
      update: { tier: 'super_admin' },
    });
    expect(res.status).toBe(500);

    const audited = vi.mocked(writeAuditLog).mock.calls[0]![0];
    const diff = audited.diff as { error: string; code: string | null };
    expect(diff.code).toBe('23505');
    expect(diff.error).toMatch(/duplicate key/i);
  });
});
