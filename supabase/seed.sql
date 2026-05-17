-- =============================================================================
-- seed.sql
--
-- Loaded by `pnpm supabase start` / `db reset` AFTER all migrations. Populates
-- the public catalog with 4 representative KSA properties so the Phase 2
-- public pages have content to render during development.
--
-- Production data flow:
--   - Real properties are added via the Phase 3 admin "Add New Property"
--     wizard, which uploads real images to Vercel Blob.
--   - This seed never runs against a remote / production project (supabase
--     CLI only runs seeds for local `db reset`).
--
-- Image URLs use placehold.co for free, no-auth, theme-coloured placeholders.
-- placehold.co is added to next.config remotePatterns so next/image can load
-- and optimise them in dev. Admins replace them with real Vercel Blob URLs
-- in Phase 3.
-- =============================================================================

-- Stable UUIDs so re-seeds are idempotent and we can deep-link by id during
-- development. The values are arbitrary v4 UUIDs generated once.

-- ---- properties -------------------------------------------------------------
insert into public.properties (
  id, slug, title_ar, title_en, description_ar, description_en,
  type, status, price_sar, price_negotiable, area_sqm,
  bedrooms, bathrooms, city, district, plot_number, street_width_m, facade,
  lat, lng, featured, featured_order
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'al-dana-21',
    'مشروع الدانة 21',
    'Al Dana Project 21',
    'دوبلكس فاخر بمساحة 250م² في حي الدانة، تصميم عصري وتشطيبات راقية بكامل الخدمات والمرافق، مع ضمان صيانة كامل لمدة عام.',
    'A 250 m² luxury duplex in Al Dana district. Modern architecture, premium finishes, smart-home ready, and a full one-year maintenance warranty.',
    'duplex', 'available', 950000, false, 250,
    5, 4, 'Riyadh', 'Al Dana', '8/1048', 20, 'north',
    24.7641, 46.7387, true, 1
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'al-yasmin-villa-7',
    'فيلا الياسمين 7',
    'Al Yasmin Villa 7',
    'فيلا مستقلة بمساحة 400م² في حي الياسمين، 6 غرف نوم، مجلس رجال ونساء، حديقة خاصة وموقف لسيارتين، تشطيبات أوروبية.',
    'Detached 400 m² villa in Al Yasmin district. Six bedrooms, separate men''s and women''s majlis, private garden, two-car parking, European finishes.',
    'villa', 'available', 2400000, true, 400,
    6, 6, 'Riyadh', 'Al Yasmin', '12/0334', 25, 'corner',
    24.8201, 46.6325, true, 2
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'al-narjis-apartment-204',
    'شقة النرجس 204',
    'Al Narjis Apartment 204',
    'شقة سكنية بمساحة 180م² في حي النرجس، 3 غرف نوم، مطبخ مجهز، تكييف مركزي، قريبة من الخدمات والمدارس.',
    'A 180 m² apartment in Al Narjis district. Three bedrooms, fitted kitchen, central A/C, walking distance to schools and amenities.',
    'apartment', 'starting_soon', 680000, false, 180,
    3, 3, 'Riyadh', 'Al Narjis', '5/0712', 15, 'east',
    24.8456, 46.6512, false, null
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'al-malqa-investment-block',
    'عمارة استثمارية - الملقا',
    'Al Malqa Investment Building',
    'عمارة استثمارية بمساحة 600م² في حي الملقا، 8 وحدات سكنية، عائد إيجاري مستقر، مطابقة للكود السعودي.',
    'A 600 m² investment building in Al Malqa district. Eight residential units, stable rental yield, Saudi Building Code compliant.',
    'investment', 'available', 4200000, true, 600,
    16, 8, 'Riyadh', 'Al Malqa', '3/0098', 30, 'south',
    24.8108, 46.6402, false, null
  );

-- ---- property_images --------------------------------------------------------
-- One hero image per property. placehold.co generates branded placeholders;
-- admins upload real images via the Phase 3 wizard.
insert into public.property_images (
  property_id, blob_url, blob_pathname, width, height, alt_ar, alt_en, position, bytes, is_hero
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'https://placehold.co/1600x1200/002B2B/D4B982/png?text=Al+Dana+21',
    'seed/al-dana-21-hero.png', 1600, 1200,
    'واجهة مشروع الدانة 21 من الشمال', 'Al Dana 21 north-facing facade', 0, 220000, true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'https://placehold.co/1600x1200/002B2B/D4B982/png?text=Al+Yasmin+7',
    'seed/al-yasmin-7-hero.png', 1600, 1200,
    'فيلا الياسمين 7 مدخل رئيسي', 'Al Yasmin Villa 7 main entrance', 0, 220000, true
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'https://placehold.co/1600x1200/002B2B/D4B982/png?text=Al+Narjis+204',
    'seed/al-narjis-204-hero.png', 1600, 1200,
    'شقة النرجس 204 المنظر الخارجي', 'Al Narjis 204 exterior view', 0, 220000, true
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'https://placehold.co/1600x1200/002B2B/D4B982/png?text=Al+Malqa+Block',
    'seed/al-malqa-block-hero.png', 1600, 1200,
    'عمارة الملقا الاستثمارية', 'Al Malqa investment building', 0, 220000, true
  );

-- ---- property_amenities -----------------------------------------------------
-- Cross-reference seeded amenity keys (from 0002_rls.sql) with the properties.
-- Use a CTE to look up amenity ids by key so the seed is robust against any
-- future re-numbering.
with amenity_keys as (
  select id, key from public.amenities
)
insert into public.property_amenities (property_id, amenity_id)
select p.property_id, a.id
from (values
  ('11111111-1111-1111-1111-111111111111', 'private_parking'),
  ('11111111-1111-1111-1111-111111111111', 'private_entrance'),
  ('11111111-1111-1111-1111-111111111111', 'modern_finishes'),
  ('11111111-1111-1111-1111-111111111111', 'smart_home_ready'),
  ('11111111-1111-1111-1111-111111111111', 'central_ac'),
  ('11111111-1111-1111-1111-111111111111', 'built_in_kitchen'),
  ('11111111-1111-1111-1111-111111111111', 'majlis'),
  ('11111111-1111-1111-1111-111111111111', 'one_year_warranty'),
  ('22222222-2222-2222-2222-222222222222', 'private_parking'),
  ('22222222-2222-2222-2222-222222222222', 'private_entrance'),
  ('22222222-2222-2222-2222-222222222222', 'modern_finishes'),
  ('22222222-2222-2222-2222-222222222222', 'central_ac'),
  ('22222222-2222-2222-2222-222222222222', 'maid_room'),
  ('22222222-2222-2222-2222-222222222222', 'driver_room'),
  ('22222222-2222-2222-2222-222222222222', 'walk_in_closet'),
  ('22222222-2222-2222-2222-222222222222', 'garden'),
  ('22222222-2222-2222-2222-222222222222', 'majlis'),
  ('22222222-2222-2222-2222-222222222222', 'one_year_warranty'),
  ('22222222-2222-2222-2222-222222222222', 'saudi_building_code'),
  ('33333333-3333-3333-3333-333333333333', 'central_ac'),
  ('33333333-3333-3333-3333-333333333333', 'built_in_kitchen'),
  ('33333333-3333-3333-3333-333333333333', 'security_door'),
  ('33333333-3333-3333-3333-333333333333', 'one_year_warranty'),
  ('44444444-4444-4444-4444-444444444444', 'private_parking'),
  ('44444444-4444-4444-4444-444444444444', 'water_meter'),
  ('44444444-4444-4444-4444-444444444444', 'security_door'),
  ('44444444-4444-4444-4444-444444444444', 'cctv_ready'),
  ('44444444-4444-4444-4444-444444444444', 'saudi_building_code')
) as p(property_id, amenity_key)
join amenity_keys a on a.key = p.amenity_key;
