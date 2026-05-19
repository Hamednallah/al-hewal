import { z } from 'zod';

/**
 * Zod schemas for the admin-management API (PR phase-3-admin-management-ui).
 *
 * Field bounds mirror the `admins` table CHECKs in `0001_init.sql`:
 *   - `email` is citext, unique, max 320 chars
 *   - `full_name` not null
 *   - `tier` enum: super_admin | standard_admin
 *   - `status` enum: active | deactivated | pending_invite
 *   - `language_pref` text in ('ar', 'en')
 */

export const ADMIN_TIERS = ['super_admin', 'standard_admin'] as const;
export const ADMIN_STATUSES = ['active', 'deactivated', 'pending_invite'] as const;

export type AdminTierValue = (typeof ADMIN_TIERS)[number];
export type AdminStatusValue = (typeof ADMIN_STATUSES)[number];

export const inviteAdminSchema = z.object({
  email: z.string().trim().email().min(3).max(320),
  full_name: z.string().trim().min(1).max(200),
  tier: z.enum(ADMIN_TIERS),
  language_pref: z.enum(['ar', 'en']).default('en'),
});

export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;

export const promoteAdminSchema = z.object({
  tier: z.enum(ADMIN_TIERS),
});

export type PromoteAdminInput = z.infer<typeof promoteAdminSchema>;
