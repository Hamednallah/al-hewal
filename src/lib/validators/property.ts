import { z } from 'zod';

/**
 * Zod schemas for the admin property create/update flows.
 *
 * Field bounds mirror the `properties` table check constraints in
 * `supabase/migrations/0001_init.sql` so the API rejects oversized input
 * before it hits the DB. `slug` is server-derived from `title_en` if the
 * admin doesn't provide one — see `slugifyTitle` below.
 *
 * The enum constants live here (not in `lib/data/admin-properties.ts`)
 * because `admin-properties.ts` is `server-only` and the client form
 * components need the same enum arrays for their dropdowns. Both sides
 * import from this module instead.
 */

export const ADMIN_PROPERTY_TYPES = ['villa', 'duplex', 'apartment', 'investment'] as const;
export const ADMIN_PROPERTY_STATUSES = [
  'draft',
  'available',
  'starting_soon',
  'reserved',
  'sold',
] as const;
/**
 * Mirrors the `properties.facade` CHECK constraint in
 * `supabase/migrations/0001_init.sql`. The Zod schema below uses
 * `z.enum(...)` against this list so the admin form can't submit a
 * value the DB will reject (PR #50 follow-up — the previous
 * free-text validator allowed any 50-char string, which produced an
 * opaque 23514 check-constraint error when an admin typed e.g.
 * Arabic `شمالية` instead of the enum literal `north`).
 */
export const ADMIN_PROPERTY_FACADES = ['north', 'south', 'east', 'west', 'corner'] as const;

export type AdminPropertyType = (typeof ADMIN_PROPERTY_TYPES)[number];
export type AdminPropertyStatus = (typeof ADMIN_PROPERTY_STATUSES)[number];
export type AdminPropertyFacade = (typeof ADMIN_PROPERTY_FACADES)[number];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const baseShape = {
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(SLUG_PATTERN, 'lowercase letters, digits, and hyphens only')
    .optional()
    .or(z.literal('')),
  title_ar: z.string().trim().min(1).max(200),
  title_en: z.string().trim().min(1).max(200),
  description_ar: z.string().trim().min(1).max(8000),
  description_en: z.string().trim().min(1).max(8000),
  type: z.enum(ADMIN_PROPERTY_TYPES),
  status: z.enum(ADMIN_PROPERTY_STATUSES).default('draft'),
  price_sar: z.coerce.number().int().nonnegative().max(1_000_000_000),
  price_negotiable: z.coerce.boolean().default(false),
  area_sqm: z.coerce.number().int().positive().max(1_000_000),
  bedrooms: z.coerce.number().int().nonnegative().max(50),
  bathrooms: z.coerce.number().int().nonnegative().max(50),
  city: z.string().trim().min(1).max(100),
  district: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  plot_number: z
    .string()
    .trim()
    .max(50)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  street_width_m: z.coerce
    .number()
    .nonnegative()
    .max(500)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v))),
  facade: z
    .enum(ADMIN_PROPERTY_FACADES)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  lat: z.coerce
    .number()
    .min(-90)
    .max(90)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v))),
  lng: z.coerce
    .number()
    .min(-180)
    .max(180)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v))),
  google_maps_url: z
    .string()
    .trim()
    .url()
    .max(500)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  featured: z.coerce.boolean().default(false),
};

export const createPropertySchema = z.object(baseShape);
export const updatePropertySchema = z.object(baseShape).partial();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
