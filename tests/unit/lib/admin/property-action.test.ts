import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/admins', () => ({
  currentAdmin: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/cache', () => ({
  revalidatePropertyPages: vi.fn().mockResolvedValue(undefined),
  revalidateAfterFeatureToggle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: vi.fn(() => ({})),
}));

import { currentAdmin } from '@/lib/auth/admins';
import { writeAuditLog } from '@/lib/audit';
import { revalidateAfterFeatureToggle, revalidatePropertyPages } from '@/lib/cache';
import { handlePropertyAction } from '@/lib/admin/property-action';
import type { AdminSessionPayload } from '@/lib/auth/session';

const VALID_UUID = '11111111-1111-7111-8111-111111111111';

function makeAdmin(overrides: Partial<AdminSessionPayload> = {}): AdminSessionPayload {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    sub: 'admin-id',
    email: 'admin@example.com',
    tier: 'super_admin',
    status: 'active',
    iat: nowSec,
    exp: nowSec + 3600,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handlePropertyAction — auth + tier gates', () => {
  it('returns 401 when no admin session exists', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(null);
    const res = await handlePropertyAction(VALID_UUID, {
      auditAction: 'update',
      mutate: vi.fn(),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'unauthorized' });
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('returns 403 when the route requires super_admin but caller is standard_admin', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin({ tier: 'standard_admin' }));
    const mutate = vi.fn();
    const res = await handlePropertyAction(VALID_UUID, {
      auditAction: 'delete',
      requireTier: 'super_admin',
      mutate,
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'forbidden' });
    expect(mutate).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('allows the action when the caller matches the required tier', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin({ tier: 'super_admin' }));
    const mutate = vi.fn().mockResolvedValue({ slug: 'villa-21' });
    const res = await handlePropertyAction(VALID_UUID, {
      auditAction: 'delete',
      requireTier: 'super_admin',
      mutate,
    });
    expect(res.status).toBe(200);
    expect(mutate).toHaveBeenCalledOnce();
  });
});

describe('handlePropertyAction — UUID validation', () => {
  it('returns 400 when the id is not a valid UUID', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin());
    const mutate = vi.fn();
    const res = await handlePropertyAction('not-a-uuid', {
      auditAction: 'update',
      mutate,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'invalid_id' });
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe('handlePropertyAction — success path', () => {
  it('runs mutate, writes the audit log, and triggers full revalidation by default', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin());
    const mutate = vi.fn().mockResolvedValue({ slug: 'al-dana-7' });
    const res = await handlePropertyAction(VALID_UUID, {
      auditAction: 'update',
      buildAuditDiff: () => ({ after: { status: 'available' } }),
      mutate,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { id: VALID_UUID, slug: 'al-dana-7' } });

    expect(mutate).toHaveBeenCalledOnce();
    expect(writeAuditLog).toHaveBeenCalledWith({
      actorId: 'admin-id',
      action: 'update',
      entity: 'property',
      entityId: VALID_UUID,
      diff: { after: { status: 'available' } },
    });
    expect(revalidatePropertyPages).toHaveBeenCalledWith('al-dana-7');
    expect(revalidateAfterFeatureToggle).not.toHaveBeenCalled();
  });

  it('uses the light feature-toggle revalidation when the mutate returns featureToggleOnly', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin());
    const mutate = vi.fn().mockResolvedValue({
      slug: 'al-dana-7',
      featureToggleOnly: true,
    });
    await handlePropertyAction(VALID_UUID, {
      auditAction: 'feature_toggle',
      requireTier: 'super_admin',
      mutate,
    });
    expect(revalidateAfterFeatureToggle).toHaveBeenCalledOnce();
    expect(revalidatePropertyPages).not.toHaveBeenCalled();
  });
});

describe('handlePropertyAction — failure path', () => {
  it('audit-logs the scrubbed error and returns 500 when mutate throws', async () => {
    vi.mocked(currentAdmin).mockResolvedValue(makeAdmin());
    const mutate = vi
      .fn()
      .mockRejectedValue(new Error('Supabase: connection refused (admin@example.com)'));
    const res = await handlePropertyAction(VALID_UUID, {
      auditAction: 'update',
      mutate,
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'mutation_failed' });
    expect(writeAuditLog).toHaveBeenCalledOnce();
    const auditedEntry = vi.mocked(writeAuditLog).mock.calls[0]![0];
    expect(auditedEntry.action).toBe('update');
    expect(auditedEntry.entityId).toBe(VALID_UUID);
    // The error message contains an email — the entry should pass through
    // `scrubPii`, removing the PII from the recorded diff.
    const diff = auditedEntry.diff as { error: string };
    expect(diff.error).not.toContain('admin@example.com');
    // And the underlying error message survives in some form.
    expect(diff.error).toMatch(/connection refused/i);
    expect(revalidatePropertyPages).not.toHaveBeenCalled();
  });
});
