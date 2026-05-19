-- =============================================================================
-- 0005_property_images_webp_url.sql
--
-- Add the WebP-variant URL to property_images so the public `<picture>`
-- element can declare an AVIF source + a WebP fallback. PR 3.5a stored
-- only the AVIF URL on `blob_url`; PR 3.5b adds `webp_url` (nullable
-- because pre-3.5b rows don't have a WebP sibling).
--
-- The `bytes` column continues to hold the AVIF variant's byte count;
-- WebP byte tracking is not separately persisted (the audit log entry
-- captures both at upload time if we ever need to reconstruct).
--
-- Append-only: this migration is shipped to the linked remote DB via
-- `pnpm supabase db push` per docs/PHASE_3_RUNBOOK.md §5 (same
-- procedure as 0004). Edit-in-place is NOT permitted once applied.
-- =============================================================================

alter table public.property_images
  add column webp_url text;

comment on column public.property_images.webp_url is
  'Public Vercel Blob URL for the WebP variant. Nullable for rows created '
  'before PR 3.5b — the public `<picture>` falls back to `blob_url` (AVIF) '
  'on those.';
