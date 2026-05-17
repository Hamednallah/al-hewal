-- =============================================================================
-- 0001_init.sql
-- Initial schema for the Al Hewal real-estate platform.
--
-- Establishes:
--   - enum types describing fixed domain vocabularies
--   - properties + property_images + amenities (the public catalog model)
--   - admins + admin_invites (invite-only admin auth)
--   - leads + whatsapp_clicks (conversion funnel data)
--   - page_views (raw analytics, partitioned monthly, pruned > 30 days)
--   - admin_audit_log (every admin mutation, with before/after diff)
--
-- Row Level Security policies and seed data live in 0002_rls.sql so the
-- structural diff is easy to read in PRs.
-- =============================================================================

-- ---- Required extensions ----------------------------------------------------
create extension if not exists "pgcrypto"   schema extensions;  -- gen_random_uuid()
create extension if not exists "pg_trgm"    schema extensions;  -- trigram search (Arabic fallback)
create extension if not exists "unaccent"   schema extensions;  -- diacritic-insensitive search
create extension if not exists "citext"     schema extensions;  -- case-insensitive email column

-- ---- Enums ------------------------------------------------------------------
create type property_type    as enum ('villa', 'duplex', 'apartment', 'investment');
create type property_status  as enum ('draft', 'available', 'starting_soon', 'reserved', 'sold');
create type lead_source      as enum ('whatsapp', 'contact_form', 'call_click');
create type admin_tier       as enum ('super_admin', 'standard_admin');
create type admin_status     as enum ('active', 'deactivated', 'pending_invite');
create type audit_action     as enum (
  'create', 'update', 'delete', 'login', 'invite',
  'promote', 'deactivate', 'feature_toggle'
);

-- ---- admins -----------------------------------------------------------------
-- One row per administrator. id is the supabase auth user id; the email
-- column is denormalised for fast filtering and audit-log joins.
create table public.admins (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           extensions.citext unique not null,
  full_name       text not null,
  avatar_url      text,
  tier            admin_tier not null default 'standard_admin',
  status          admin_status not null default 'pending_invite',
  language_pref   text not null default 'en' check (language_pref in ('ar', 'en')),
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index admins_status_tier_idx on public.admins (status, tier);

comment on table public.admins is
  'Administrators of the Al Hewal platform. Mirrors auth.users with role + status metadata.';
comment on column public.admins.tier is
  'super_admin: full CRUD on properties + admins. standard_admin: properties + leads only.';

-- ---- admin_invites ----------------------------------------------------------
-- Magic-link invitations issued by super admins. We store ONLY the SHA-256
-- hash of the invitation token; the raw token is sent via the Supabase
-- Auth invite email and is never persisted by us.
create table public.admin_invites (
  id          uuid primary key default extensions.gen_random_uuid(),
  email       extensions.citext not null,
  tier        admin_tier not null,
  invited_by  uuid not null references public.admins(id) on delete restrict,
  token_hash  text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index admin_invites_email_pending_idx
  on public.admin_invites (lower(email::text))
  where consumed_at is null;
create index admin_invites_expires_idx on public.admin_invites (expires_at) where consumed_at is null;

comment on table public.admin_invites is
  'Pending and consumed admin invitations. Tokens stored as SHA-256 hash only.';

-- ---- properties -------------------------------------------------------------
-- Bilingual title + description; one shared slug per locale (so the locale
-- switcher round-trips without re-keying the URL). Search uses a tsvector
-- over both languages; pg_trgm on title_ar as the Arabic fallback.
create table public.properties (
  id                  uuid primary key default extensions.gen_random_uuid(),
  slug                text unique not null,
  title_ar            text not null,
  title_en            text not null,
  description_ar      text not null,
  description_en      text not null,
  type                property_type not null,
  status              property_status not null default 'draft',
  price_sar           numeric(12, 2) not null check (price_sar >= 0),
  price_negotiable    boolean not null default false,
  area_sqm            numeric(8, 2) not null check (area_sqm > 0),
  bedrooms            smallint not null check (bedrooms between 0 and 20),
  bathrooms           smallint not null check (bathrooms between 0 and 20),
  city                text not null,
  district            text,
  plot_number         text,
  street_width_m      smallint check (street_width_m is null or street_width_m between 0 and 100),
  facade              text check (facade is null or facade in ('north', 'south', 'east', 'west', 'corner')),
  lat                 numeric(10, 7) check (lat is null or (lat between -90 and 90)),
  lng                 numeric(11, 7) check (lng is null or (lng between -180 and 180)),
  google_maps_url     text,
  hero_image_id       uuid,             -- fk added after property_images creation
  featured            boolean not null default false,
  featured_order      smallint,
  view_count_total    integer not null default 0,
  search_vector       tsvector generated always as (
    setweight(to_tsvector('simple',  coalesce(title_ar, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title_en, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description_en, '')), 'C')
  ) stored,
  created_by          uuid references public.admins(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index properties_status_featured_idx
  on public.properties (status, featured, featured_order nulls last)
  where deleted_at is null;
create index properties_type_price_idx
  on public.properties (type, price_sar)
  where deleted_at is null;
create index properties_city_idx
  on public.properties (city)
  where deleted_at is null;
create index properties_search_idx
  on public.properties using gin (search_vector);
create index properties_title_ar_trgm_idx
  on public.properties using gin (title_ar extensions.gin_trgm_ops);

comment on table public.properties is
  'Real-estate listings shown on the public site. Soft-deleted via deleted_at.';

-- ---- property_images --------------------------------------------------------
-- Image metadata. Files live on Vercel Blob; we keep only the URL and
-- the dimensions needed by Next/Image. alt_ar and alt_en are NOT NULL
-- to force bilingual accessibility from the upload UI onwards.
create table public.property_images (
  id            uuid primary key default extensions.gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  blob_url      text not null,
  blob_pathname text not null,
  width         integer not null check (width > 0 and width <= 8000),
  height        integer not null check (height > 0 and height <= 8000),
  blurhash      text,
  alt_ar        text not null check (length(trim(alt_ar)) > 0),
  alt_en        text not null check (length(trim(alt_en)) > 0),
  position      smallint not null default 0,
  bytes         integer not null check (bytes > 0),
  created_at    timestamptz not null default now()
);
create index property_images_property_pos_idx
  on public.property_images (property_id, position);

-- Wire the hero_image_id FK on properties now that property_images exists.
alter table public.properties
  add constraint properties_hero_image_fk
    foreign key (hero_image_id) references public.property_images(id) on delete set null;

-- ---- amenities (seeded in 0002_rls.sql) -------------------------------------
create table public.amenities (
  id        smallserial primary key,
  key       text unique not null,            -- 'private_parking'
  label_ar  text not null,
  label_en  text not null,
  icon      text not null,                   -- Material Symbols icon name
  category  text                             -- 'interior' | 'exterior' | 'smart' | 'safety'
);

create table public.property_amenities (
  property_id uuid not null references public.properties(id) on delete cascade,
  amenity_id  smallint not null references public.amenities(id) on delete restrict,
  primary key (property_id, amenity_id)
);
create index property_amenities_amenity_idx on public.property_amenities (amenity_id);

-- ---- leads -------------------------------------------------------------------
-- Captured contact intent from any of three sources. PII minimisation:
-- ip_hash, never raw IP. Phone numbers normalised to E.164 at the API
-- boundary (libphonenumber-js).
create table public.leads (
  id          uuid primary key default extensions.gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  source      lead_source not null,
  name        text,
  phone       text check (phone is null or phone ~ '^\+?[1-9][0-9]{6,14}$'),
  email       extensions.citext,
  message     text,
  locale      text not null check (locale in ('ar', 'en')),
  ip_hash     text,
  user_agent  text,
  referrer    text,
  country     text,
  region      text,
  city        text,
  contacted_at timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_property_created_idx on public.leads (property_id, created_at desc);
create index leads_source_idx on public.leads (source, created_at desc);

comment on table public.leads is
  'All inbound contact attempts. NEVER store raw IP — only sha256(ip + daily_salt).';

-- ---- whatsapp_clicks --------------------------------------------------------
-- Denormalised mirror of WhatsApp-source leads for fast analytics queries
-- (counts by property, by day, by region) without scanning the wider
-- leads table.
create table public.whatsapp_clicks (
  id          bigserial primary key,
  lead_id     uuid references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index whatsapp_clicks_property_idx on public.whatsapp_clicks (property_id, created_at desc);
create index whatsapp_clicks_day_idx on public.whatsapp_clicks (date_trunc('day', created_at));

-- ---- page_views -------------------------------------------------------------
-- Raw per-pageview rows, partitioned monthly so old data can be dropped
-- cheaply (partition DROP > DELETE on a 500MB free-tier DB).
-- pg_cron in 0004_cron.sql will create future partitions automatically
-- and roll the > 30-day partitions into page_views_daily before drop.
create table public.page_views (
  id            bigserial,
  path          text not null,
  property_id   uuid references public.properties(id) on delete set null,
  locale        text not null check (locale in ('ar', 'en')),
  visitor_hash  text not null,
  country       text,
  region        text,
  created_at    timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

-- Initial monthly partition covering the first launch month.
-- 0004_cron.sql adds the partition-management cron job.
create table public.page_views_y2026m05 partition of public.page_views
  for values from ('2026-05-01') to ('2026-06-01');
create index page_views_y2026m05_property_idx
  on public.page_views_y2026m05 (property_id, created_at desc);

-- Rolled-up daily aggregate that the analytics dashboard reads.
create table public.page_views_daily (
  date          date not null,
  property_id   uuid references public.properties(id) on delete set null,
  locale        text not null check (locale in ('ar', 'en')),
  country       text,
  region        text,
  view_count    integer not null check (view_count >= 0),
  primary key (date, property_id, locale, country, region)
);
create index page_views_daily_date_idx on public.page_views_daily (date desc);

-- ---- admin_audit_log --------------------------------------------------------
-- Append-only log of every admin mutation. Visible only to super_admin
-- via RLS in 0002_rls.sql.
create table public.admin_audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.admins(id) on delete set null,
  action      audit_action not null,
  entity      text not null,                -- 'property' | 'admin' | 'invite' | 'lead'
  entity_id   text,
  diff        jsonb,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index admin_audit_log_actor_idx   on public.admin_audit_log (actor_id, created_at desc);
create index admin_audit_log_entity_idx  on public.admin_audit_log (entity, entity_id, created_at desc);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- ---- updated_at touch trigger ----------------------------------------------
create or replace function public.touch_updated_at() returns trigger
  language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_properties_updated
  before update on public.properties
  for each row execute function public.touch_updated_at();

create trigger touch_admins_updated
  before update on public.admins
  for each row execute function public.touch_updated_at();
