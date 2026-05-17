-- =============================================================================
-- 0003_review_fixes.sql
--
-- Addresses the senior DB / backend / architect review captured in
-- docs/DB_REVIEW_RESPONSE.md. Migrations 0001 and 0002 are append-only
-- and must not be edited once merged, so every change below is expressed
-- as an ALTER / DROP / CREATE on top of what those migrations established.
--
-- Items addressed here (numbers match the review):
--   #1  date_trunc()-based index replaced with a STORED generated date column
--   #2  page_views gains a DEFAULT partition so inserts never fail when a
--       monthly partition is missing
--   #3  hero_image_id replaced with property_images.is_hero +
--       partial-unique index that guarantees same-property ownership
--   #4  updated_at added to leads (admins update notes); intentionally
--       omitted on admin_invites (immutable token) and amenities (lookup)
--   #5  featured_order CHECK + partial-unique index for active features
--   #6  anon INSERT on leads REVOKED — all submissions go through the
--       service-role API route (`/api/leads`) which enforces rate limits,
--       Zod validation, Origin check, and audit
--   #7  admin self-update privilege escalation closed via a row trigger
--       that blocks any non-super_admin from changing tier / status /
--       email of their own row
--   #8  Composite index for the catalog's primary filter pattern
--       (city, status, created_at desc) added
--   #10 lat / lng switched from numeric(10,7) / numeric(11,7) to
--       double precision (faster, less storage, sufficient precision)
--   #9  view_count_total dropped — derive from page_views_daily on demand
--
-- Items NOT applied here, with rationale in docs/DB_REVIEW_RESPONSE.md:
--   #11 PostGIS                — deferred until a feature actually needs it
--   #12 enums -> lookup tables — intentionally keeping enums for MVP
--   #13 Arabic search backend  — trigram fallback is sufficient for MVP
--   #14 page_views_daily PK    — composite PK is the correct dimension
--                                model; we enforce NOT NULL DEFAULT '' on
--                                country/region (added below) to avoid the
--                                NULL behaviour the reviewer warned about
--   #15 audit log archival     — operational concern, addressed in Phase 5
-- =============================================================================

-- ---- #1: WhatsApp clicks day index ------------------------------------------
-- date_trunc('day', timestamptz) is not IMMUTABLE because the timestamp's
-- text representation depends on the session TimeZone GUC, so PostgreSQL
-- (correctly) refuses to use it in an index expression. The right fix is
-- a STORED generated column that materialises the UTC date at write time;
-- the index then references a plain column.
drop index if exists public.whatsapp_clicks_day_idx;

alter table public.whatsapp_clicks
  add column created_day date
    generated always as ((created_at at time zone 'UTC')::date) stored;

create index whatsapp_clicks_day_idx on public.whatsapp_clicks (created_day);

-- ---- #2: page_views DEFAULT partition --------------------------------------
-- Without a DEFAULT partition, any insert whose created_at falls outside
-- the manually pre-created month partitions ERRORS with
-- "no partition of relation found for row" — production outage on the 1st
-- of next month. pg_cron in a later migration will move rows from the
-- DEFAULT partition into proper monthly partitions, but until then writes
-- never fail.
create table if not exists public.page_views_default
  partition of public.page_views default;
create index if not exists page_views_default_property_idx
  on public.page_views_default (property_id, created_at desc);

-- ---- #3: hero image redesign -----------------------------------------------
-- The hero_image_id column on properties cannot be constrained to
-- "image belongs to this property" without a cross-table trigger; the
-- cleaner model is a boolean on property_images plus a partial-unique
-- index that enforces "at most one hero per property" and intrinsically
-- guarantees the hero is owned by its property.
alter table public.properties
  drop constraint if exists properties_hero_image_fk;
alter table public.properties
  drop column if exists hero_image_id;

alter table public.property_images
  add column is_hero boolean not null default false;

create unique index property_images_one_hero_per_property_idx
  on public.property_images (property_id)
  where is_hero = true;

-- Convenience index for the public catalog card render path.
create index property_images_hero_lookup_idx
  on public.property_images (property_id)
  where is_hero = true;

-- ---- #4: updated_at on leads -----------------------------------------------
-- Admins update lead notes and the `contacted_at` field; without an
-- updated_at column we lose the "when did this row last change" signal.
-- admin_invites is intentionally append-only (status changes via
-- consumed_at, not row updates) so it does not get the trigger.
-- amenities is a seeded lookup table and rarely changes; also omitted.
alter table public.leads
  add column updated_at timestamptz not null default now();

create trigger touch_leads_updated
  before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---- #5: featured_order constraints -----------------------------------------
alter table public.properties
  drop constraint if exists properties_featured_order_check;
alter table public.properties
  add constraint properties_featured_order_check
    check (featured_order is null or featured_order >= 0);

-- Ordering across the "featured strip" must be deterministic — no two
-- live featured properties may share an order slot.
create unique index if not exists properties_featured_order_unique
  on public.properties (featured_order)
  where featured = true and deleted_at is null and featured_order is not null;

-- ---- #6: leads spam protection ---------------------------------------------
-- Revoke anonymous direct-INSERT on leads. All public lead submissions
-- now go through `/api/leads` (Phase 2) which runs Zod validation, Upstash
-- rate limiting (5/min/IP for the contact form, 10/min/IP for whatsapp/track),
-- Origin header check, and writes via the service-role client.
drop policy if exists "anon submits leads" on public.leads;
revoke insert on public.leads from anon;

-- Service-role inserts bypass RLS entirely (that is how the service role
-- works in Supabase); no policy is needed for the API route.

-- ---- #7: admin self-update privilege escalation -----------------------------
-- The "admins update own profile" policy lets a row owner UPDATE their row,
-- but RLS cannot restrict which COLUMNS may change. Without this trigger a
-- standard_admin could craft an `update admins set tier = 'super_admin'`
-- that satisfies the policy. The trigger inspects the diff and rejects
-- changes to privileged columns unless the actor is a super_admin.
create or replace function public.admins_protect_privileged_fields()
  returns trigger language plpgsql
as $$
declare
  is_super boolean;
begin
  -- Bypass the trigger for the service role (used by invite-acceptance
  -- and tier-change API endpoints which run with full privileges).
  -- session_user is 'postgres'/'supabase_admin' for the service role.
  if (select rolsuper from pg_roles where rolname = current_user) then
    return new;
  end if;

  is_super := public.is_super_admin();

  if not is_super then
    if new.tier is distinct from old.tier then
      raise exception 'tier may only be changed by a super_admin'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      raise exception 'status may only be changed by a super_admin'
        using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'email may only be changed by a super_admin'
        using errcode = '42501';
    end if;
    if new.id is distinct from old.id then
      raise exception 'admin id is immutable'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger admins_protect_privileged_fields_trg
  before update on public.admins
  for each row execute function public.admins_protect_privileged_fields();

-- ---- #8: composite catalog filter index -------------------------------------
-- The public catalog's primary filter is (city, status) ordered by recency.
-- The previous indexes covered (status, featured) and (type, price); add
-- the missing (city, status, created_at desc) composite so the most
-- common query plan is index-only.
create index if not exists properties_listing_idx
  on public.properties (city, status, created_at desc)
  where deleted_at is null;

-- ---- #10: lat / lng as double precision -------------------------------------
-- numeric is variable-width, calculated in software, and only useful when
-- exact decimal precision is required (money). Coordinates are physics —
-- double precision is faster, half the storage of numeric(10,7) at this
-- precision, and any future PostGIS migration converts trivially.
alter table public.properties
  alter column lat type double precision using lat::double precision,
  alter column lng type double precision using lng::double precision;

-- Re-state the bounds checks against the new column type. The old check
-- constraints reference the numeric column and PostgreSQL keeps them, but
-- being explicit avoids ambiguity in future ALTER TABLE diffs.
alter table public.properties
  drop constraint if exists properties_lat_check,
  drop constraint if exists properties_lng_check;
alter table public.properties
  add constraint properties_lat_check
    check (lat is null or (lat between -90.0 and 90.0)),
  add constraint properties_lng_check
    check (lng is null or (lng between -180.0 and 180.0));

-- ---- #9: drop the denormalised view_count_total ----------------------------
-- The "Hottest Properties" chart on the analytics dashboard reads from
-- page_views_daily directly. The counter on properties was a stale
-- denormalisation prone to write contention; dropping it removes a hot
-- update path and one fewer reason for transactional bloat.
alter table public.properties drop column if exists view_count_total;

-- ---- #14 supporting fix: enforce non-NULL dimensions on page_views_daily ----
-- The reviewer flagged composite-PK NULL behaviour. The dimension model is
-- correct (date + property + locale + country + region IS the natural key),
-- but we have to guarantee no NULL gets into the dimension columns. The
-- rollup function will COALESCE missing geo to ''; enforce it here too.
alter table public.page_views_daily
  alter column country set default '',
  alter column country set not null,
  alter column region set default '',
  alter column region set not null;
