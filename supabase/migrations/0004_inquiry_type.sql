-- =============================================================================
-- 0004_inquiry_type.sql
--
-- Add a topic classification to inbound leads so the public ContactForm can
-- distinguish a general inquiry from a maintenance request.
--
-- Why a dedicated column (not an extension of `lead_source`):
--   `lead_source` already means "where did the click come from?"
--   (whatsapp / contact_form / call_click). Topic is an orthogonal axis —
--   conflating the two breaks the obvious analytics query "how many
--   maintenance requests came in via WhatsApp vs the form?".
--
-- Why `not null default 'general'`:
--   Existing rows backfill cleanly to the most common topic, and the public
--   ContactForm sends a value on every submit (default to 'general' on the
--   form too). The NOT NULL keeps server-side branching predictable.
--
-- Index choice: (inquiry_type, created_at desc) — the Phase 3.6 Leads
-- Journal will filter by topic + scroll backwards in time. Same shape as
-- the existing `leads_source_idx`.
--
-- Future extension: add 'partnership', 'media', 'bulk_inquiry' values via
-- `alter type inquiry_type add value '<name>'` — Postgres enum extension
-- is non-destructive and safe to run concurrently with reads.
-- =============================================================================

create type inquiry_type as enum ('general', 'maintenance');

alter table public.leads
  add column inquiry_type inquiry_type not null default 'general';

create index leads_inquiry_type_idx
  on public.leads (inquiry_type, created_at desc);

comment on column public.leads.inquiry_type is
  'Topic classification: general (default) or maintenance. Driven by the radio group on the public ContactForm; PR 3.6 Leads Journal filters by this column.';
