import { describe, expect, it } from 'vitest';

import {
  ADMIN_STATUSES,
  ADMIN_TIERS,
  inviteAdminSchema,
  promoteAdminSchema,
} from '@/lib/validators/admin';

const VALID_INVITE = {
  email: 'newadmin@al-hewal.sa',
  full_name: 'Aisha Al-Mansour',
  tier: 'standard_admin' as const,
  language_pref: 'ar' as const,
};

describe('admin validators', () => {
  describe('inviteAdminSchema', () => {
    it('accepts a well-formed invite payload', () => {
      const out = inviteAdminSchema.safeParse(VALID_INVITE);
      expect(out.success).toBe(true);
    });

    it('defaults language_pref to "en" when missing', () => {
      const { language_pref: _drop, ...rest } = VALID_INVITE;
      const out = inviteAdminSchema.safeParse(rest);
      expect(out.success).toBe(true);
      if (out.success) expect(out.data.language_pref).toBe('en');
    });

    it('rejects a malformed email', () => {
      expect(inviteAdminSchema.safeParse({ ...VALID_INVITE, email: 'not-an-email' }).success).toBe(
        false,
      );
    });

    it('rejects an empty full_name', () => {
      expect(inviteAdminSchema.safeParse({ ...VALID_INVITE, full_name: '' }).success).toBe(false);
      expect(inviteAdminSchema.safeParse({ ...VALID_INVITE, full_name: '   ' }).success).toBe(
        false,
      );
    });

    it('rejects unknown tier values', () => {
      expect(inviteAdminSchema.safeParse({ ...VALID_INVITE, tier: 'owner' }).success).toBe(false);
      expect(inviteAdminSchema.safeParse({ ...VALID_INVITE, tier: '' }).success).toBe(false);
    });

    it('rejects unsupported language_pref values', () => {
      expect(inviteAdminSchema.safeParse({ ...VALID_INVITE, language_pref: 'fr' }).success).toBe(
        false,
      );
    });
  });

  describe('promoteAdminSchema', () => {
    it('accepts either tier value', () => {
      expect(promoteAdminSchema.safeParse({ tier: 'super_admin' }).success).toBe(true);
      expect(promoteAdminSchema.safeParse({ tier: 'standard_admin' }).success).toBe(true);
    });
    it('rejects missing tier', () => {
      expect(promoteAdminSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('enum constants', () => {
    it('exports the canonical tier + status values', () => {
      expect(ADMIN_TIERS).toEqual(['super_admin', 'standard_admin']);
      expect(ADMIN_STATUSES).toEqual(['active', 'deactivated', 'pending_invite']);
    });
  });
});
