-- =============================================================================
-- 0007_more_amenities.sql
--
-- Append KSA-specific amenities the original 20-row seed in
-- `0002_rls.sql` didn't cover. The gap surfaced during entry of the
-- first real property (Al Dana 21, May 2026):
--
--   - The ad listed `صالة` (family lounge) as distinct from the
--     `مجلس` (men's formal reception) — both are standard in any
--     mid-tier-and-above KSA villa/duplex. The seed had only
--     `majlis`, so `family_lounge` is added here.
--   - Several other common features (pool, elevator, balcony,
--     office, children's room, solar panels, furnished) were
--     missing too. Added preemptively so the next 3-4 listings
--     don't hit the same gap.
--
-- Idempotent: ON CONFLICT (key) DO NOTHING makes repeated runs
-- against a partially-seeded DB safe.
--
-- Icons reference Material Symbols (same convention as the
-- original seed rows in 0002_rls.sql).
-- =============================================================================

insert into public.amenities (key, label_ar, label_en, icon, category) values
  ('elevator',      'مصعد',           'Elevator',           'elevator',       'interior'),
  ('pool',          'مسبح',           'Swimming Pool',      'pool',           'exterior'),
  ('family_lounge', 'صالة عائلية',     'Family Lounge',      'weekend',        'interior'),
  ('children_room', 'غرفة أطفال',      'Children''s Room',   'crib',           'interior'),
  ('office',        'مكتب',            'Office / Study',     'desk',           'interior'),
  ('balcony',       'شرفة',            'Balcony',            'balcony',        'exterior'),
  ('furnished',     'مفروش',           'Furnished',          'chair',          'interior'),
  ('solar_panels',  'ألواح شمسية',     'Solar Panels',       'solar_power',    'smart')
on conflict (key) do nothing;
