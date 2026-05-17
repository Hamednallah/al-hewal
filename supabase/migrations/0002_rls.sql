-- =============================================================================
-- 0002_rls.sql
-- Row Level Security policies + seed reference data.
--
-- Default-deny: every table has RLS enabled, no policies grant access until
-- explicitly defined below. This is the second line of defense behind the
-- application's `lib/supabase/admin.ts` server-only client.
--
-- Three principals exist:
--   - anon         : unauthenticated public visitors
--   - authenticated: any signed-in user (must also have an admins row)
--   - service_role : server-side only, bypasses RLS entirely
--
-- The `is_active_admin()` and `is_super_admin()` helpers centralise the
-- "do I have a non-deactivated admin row?" check so each policy stays
-- one expression.
-- =============================================================================

-- ---- Helper functions -------------------------------------------------------
create or replace function public.is_active_admin() returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admins
     where id = auth.uid()
       and status = 'active'
  );
$$;

create or replace function public.is_super_admin() returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admins
     where id = auth.uid()
       and status = 'active'
       and tier = 'super_admin'
  );
$$;

revoke all on function public.is_active_admin() from public;
revoke all on function public.is_super_admin() from public;
grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- ---- Enable RLS on every public table --------------------------------------
alter table public.admins              enable row level security;
alter table public.admin_invites       enable row level security;
alter table public.properties          enable row level security;
alter table public.property_images     enable row level security;
alter table public.amenities           enable row level security;
alter table public.property_amenities  enable row level security;
alter table public.leads               enable row level security;
alter table public.whatsapp_clicks     enable row level security;
alter table public.page_views          enable row level security;
alter table public.page_views_daily    enable row level security;
alter table public.admin_audit_log     enable row level security;

-- ---- properties ------------------------------------------------------------
-- anon can read live (published, non-deleted) listings only.
create policy "anon reads live properties"
  on public.properties for select to anon
  using (status <> 'draft' and deleted_at is null);

-- active admins can read everything including drafts and soft-deleted rows.
create policy "admins read all properties"
  on public.properties for select to authenticated
  using (public.is_active_admin());

-- standard_admin can insert and update; soft-delete via update.
create policy "admins insert properties"
  on public.properties for insert to authenticated
  with check (public.is_active_admin());

create policy "admins update properties"
  on public.properties for update to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- hard delete reserved for super_admin.
create policy "super admins hard delete properties"
  on public.properties for delete to authenticated
  using (public.is_super_admin());

-- ---- property_images -------------------------------------------------------
-- anon reads images belonging to live properties only.
create policy "anon reads live property images"
  on public.property_images for select to anon
  using (exists (
    select 1 from public.properties p
     where p.id = property_id
       and p.status <> 'draft'
       and p.deleted_at is null
  ));

create policy "admins read all property images"
  on public.property_images for select to authenticated
  using (public.is_active_admin());

create policy "admins write property images"
  on public.property_images for all to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- ---- amenities (lookup) ----------------------------------------------------
-- Public read; super admin write.
create policy "anon reads amenities"
  on public.amenities for select to anon
  using (true);

create policy "authenticated reads amenities"
  on public.amenities for select to authenticated
  using (true);

create policy "super admins write amenities"
  on public.amenities for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---- property_amenities (join) ---------------------------------------------
create policy "anon reads property amenities of live properties"
  on public.property_amenities for select to anon
  using (exists (
    select 1 from public.properties p
     where p.id = property_id
       and p.status <> 'draft'
       and p.deleted_at is null
  ));

create policy "admins write property amenities"
  on public.property_amenities for all to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- ---- leads -----------------------------------------------------------------
-- anon may INSERT (contact form), but never SELECT.
create policy "anon submits leads"
  on public.leads for insert to anon
  with check (true);

create policy "admins read leads"
  on public.leads for select to authenticated
  using (public.is_active_admin());

create policy "admins update lead notes"
  on public.leads for update to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

create policy "super admins delete leads"
  on public.leads for delete to authenticated
  using (public.is_super_admin());

-- ---- whatsapp_clicks --------------------------------------------------------
-- Inserts only via the service-role server endpoint; admins read.
create policy "admins read whatsapp clicks"
  on public.whatsapp_clicks for select to authenticated
  using (public.is_active_admin());

-- ---- page_views -------------------------------------------------------------
-- Inserts only via service role; admins read aggregated only (via daily MV
-- policy below). We still expose select to admins on raw partitions for
-- ad-hoc debugging.
create policy "admins read page views"
  on public.page_views for select to authenticated
  using (public.is_active_admin());

create policy "admins read daily page views"
  on public.page_views_daily for select to authenticated
  using (public.is_active_admin());

-- ---- admins ----------------------------------------------------------------
-- Self read for non-super admins; super admin reads all.
create policy "admins read own row"
  on public.admins for select to authenticated
  using (id = auth.uid() and public.is_active_admin());

create policy "super admins read all admin rows"
  on public.admins for select to authenticated
  using (public.is_super_admin());

-- Self profile update for non-super (only display fields).
create policy "admins update own profile"
  on public.admins for update to authenticated
  using (id = auth.uid() and public.is_active_admin())
  with check (id = auth.uid() and public.is_active_admin());

-- Super admin can flip any tier or status.
create policy "super admins write admins"
  on public.admins for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---- admin_invites ----------------------------------------------------------
create policy "super admins read invites"
  on public.admin_invites for select to authenticated
  using (public.is_super_admin());

create policy "super admins write invites"
  on public.admin_invites for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---- admin_audit_log --------------------------------------------------------
-- Read-only for super admin. Inserts only via service-role wrapper.
create policy "super admins read audit log"
  on public.admin_audit_log for select to authenticated
  using (public.is_super_admin());

-- =============================================================================
-- Seed amenities (matched to the property mockups + Al Dana sample listing).
-- =============================================================================
insert into public.amenities (key, label_ar, label_en, icon, category) values
  ('private_parking',     'موقف خاص',                 'Private Parking',        'directions_car',         'exterior'),
  ('private_entrance',    'مدخل خاص',                 'Private Entrance',       'door_front',             'exterior'),
  ('water_meter',         'عداد مياه مستقل',           'Independent Water Meter','water_drop',             'exterior'),
  ('modern_finishes',     'تشطيبات حديثة',             'Modern Finishes',        'design_services',        'interior'),
  ('smart_home_ready',    'جاهز للمنزل الذكي',        'Smart-Home Ready',       'home_iot_device',        'smart'),
  ('central_ac',          'تكييف مركزي',               'Central AC',             'mode_fan',               'interior'),
  ('built_in_kitchen',    'مطبخ مجهز',                 'Built-in Kitchen',       'kitchen',                'interior'),
  ('maid_room',           'غرفة خادمة',                'Maid Room',              'bed',                    'interior'),
  ('driver_room',         'غرفة سائق',                 'Driver Room',            'bed',                    'interior'),
  ('storage_room',        'مستودع',                    'Storage Room',           'warehouse',              'interior'),
  ('laundry_room',        'غرفة غسيل',                 'Laundry Room',           'local_laundry_service',  'interior'),
  ('majlis',              'مجلس',                      'Majlis',                 'weekend',                'interior'),
  ('formal_dining',       'غرفة طعام رسمية',           'Formal Dining Room',     'restaurant',             'interior'),
  ('walk_in_closet',      'غرفة ملابس',                'Walk-in Closet',         'checkroom',              'interior'),
  ('garden',              'حديقة',                     'Garden',                 'park',                   'exterior'),
  ('roof_terrace',        'سطح',                       'Roof Terrace',           'deck',                   'exterior'),
  ('security_door',       'باب أمان',                  'Security Door',          'lock',                   'safety'),
  ('cctv_ready',          'جاهز لكاميرات المراقبة',    'CCTV-Ready Wiring',      'videocam',               'safety'),
  ('one_year_warranty',   'ضمان عام كامل',             '1-Year Maintenance Warranty', 'verified',          'safety'),
  ('saudi_building_code', 'مطابق للكود السعودي',       'Saudi Building Code Compliant', 'verified_user',   'safety');
