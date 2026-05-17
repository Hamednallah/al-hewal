# DB Review Response

This document responds to the senior DB / backend / architect review
delivered against migrations `0001_init.sql` and `0002_rls.sql`. The
review is captured at `../../DB-review.md` (outside the repo).

For each item I state: **what the reviewer said**, **what I changed**
(or did not), and **why**. Where I disagree, I push back with reasoning.

The structural follow-ups land in
[`supabase/migrations/0003_review_fixes.sql`](../supabase/migrations/0003_review_fixes.sql).
Migrations `0001` and `0002` are append-only (CLAUDE.md rule) so every
change is expressed as ALTER / DROP / CREATE on top.

---

## Critical / High — APPLIED

### #1 `date_trunc()` index on `whatsapp_clicks` — APPLIED (INLINED into 0001)

The reviewer is right. `date_trunc('day', timestamptz)` is not
`IMMUTABLE` because the timestamp's text representation depends on the
session `TimeZone` GUC, so PostgreSQL refuses it in an index expression.
Worse than "would fail at first `INSERT`" — **the broken `CREATE
INDEX` aborts the migration apply itself**, before any other statement
runs. A fresh `pnpm supabase start` failed at statement 38 of 0001 and
rolled back. Fix in 0003 alone is not enough because 0003 never runs.

**Fix:** the STORED generated column +
`(created_day)` index were **inlined into 0001** directly. 0001 had not
yet been applied to any shared database when the bug surfaced, so the
"append-only after merge" rule did not apply — until first apply,
fixing a migration in place is the right call. CLAUDE.md was updated
to make that rule explicit. 0003 still carries the review-trail
comment for #1 but no longer runs the DROP/ALTER/CREATE block.

### #2 `page_views` partitioning will eventually fail — APPLIED

The reviewer is right. With only `y2026m05` pre-created, the first insert
in June 2026 errors with "no partition of relation found for row".

**Fix:** added `page_views_default` as a `DEFAULT` partition. Pg_cron in
a later migration creates next-month partitions in advance and migrates
rows out of the default partition; until then writes never fail.

### #3 Hero image ownership — APPLIED (with the reviewer's Option A)

The reviewer is right. A `hero_image_id uuid` column on `properties`
cannot be constrained to "image belongs to this property" without a
cross-table trigger.

**Fix:** dropped `hero_image_id` and added `is_hero boolean` on
`property_images`, with a partial-unique index that enforces "at most
one hero per property". Ownership is intrinsically guaranteed by the
existing `property_id` FK.

### #5 `featured_order` constraints — APPLIED

The reviewer is right.

**Fix:**

- `CHECK (featured_order is null or featured_order >= 0)`
- Partial-unique index across active, featured, ordered rows so no two
  live featured properties share an order slot.

### #6 Lead spam abuse — APPLIED

The reviewer is right. `with check (true)` on anon inserts is an
unbounded bot-flood vector.

**Fix:** dropped the anon insert policy and `REVOKE INSERT ON
public.leads FROM anon`. All public lead submissions now flow through
`/api/leads` (Phase 2), which enforces:

- Zod schema validation (`.strict()`, no extra fields)
- Upstash rate limit (5/min/IP contact form, 10/min/IP whatsapp/track)
- `Origin` header check against `NEXT_PUBLIC_SITE_URL`
- Service-role insert with audit log row
- Phone normalisation to E.164 via `libphonenumber-js`
- IP hashed with daily-rotated salt before storage

### #7 Admin self-update privilege escalation — APPLIED

The reviewer is right. RLS cannot restrict columns, so an active
standard admin could craft `update admins set tier = 'super_admin' where
id = auth.uid()` and the policy would allow it.

**Fix:** `admins_protect_privileged_fields()` BEFORE-UPDATE row trigger
rejects any change to `tier`, `status`, `email`, or `id` unless the
acting role is `super_admin` (or the service role for invite
acceptance / tier-change endpoints). Returns SQLSTATE 42501 so the
client sees a clear permission error.

### #8 Composite catalog index — APPLIED

Without a composite, the catalog's `WHERE city = ? AND status =
'available' AND deleted_at IS NULL ORDER BY created_at DESC` query plan
relies on individual indexes plus a sort.

**Fix:** added partial index on `(city, status, created_at desc)
WHERE deleted_at IS NULL`.

### #10 `numeric` vs `double precision` for lat/lng — APPLIED

The reviewer is right. `numeric(10,7)` is software-calculated and
variable-width; `double precision` is hardware-fast at the precision
needed for map embedding (about 1.1 cm at the equator).

**Fix:** `ALTER COLUMN lat / lng TYPE double precision`. CHECK
constraints re-stated against the new types.

### #9 `view_count_total` contention hotspot — APPLIED (REMOVED)

The reviewer suggested removing or async-computing. The `denormalised
counter, async batch` comment in 0001 implied nightly batch updates,
but in practice every pageview would have triggered a row UPDATE
sooner or later.

**Fix:** dropped the column. The "Hottest Properties" chart reads
`page_views_daily` directly, which is what the analytics dashboard was
going to do anyway. One fewer hot row, less HOT-update bloat.

---

## Push-backs (rejected with reasoning)

### #11 Add PostGIS — DEFERRED (intentionally)

PostGIS is a great hammer but every nail isn't a map. Right now the
maps are Google-Maps-Embed-style "show this single point on a map";
they take a `(lat, lng)` pair, render an iframe, and that's it. There
is no nearby-search, no bounding-box query, no radius filter — and
none are in the Phase 2-5 spec. Adding PostGIS now is YAGNI: it costs
an extension, more disk, and more migrations, with no current consumer.

When a real geospatial feature shows up (Phase 6+ "search within X km
of Riyadh"), we migrate `lat`/`lng` to `geography(point, 4326)` in one
ALTER and switch the queries. The current `double precision` columns
convert losslessly.

### #12 Replace enums with lookup tables — REJECTED

Enums are fine for fixed domain vocabularies that the application owns
and that change at deploy time (`property_type`, `property_status`,
`admin_tier`, `audit_action`). They are:

- type-safe in TypeScript via `supabase gen types`
- referentially light (one byte on disk)
- impossible to mis-spell in queries (PostgreSQL rejects unknown values)
- atomically extensible since PostgreSQL 12 (`ALTER TYPE ... ADD VALUE`
  no longer needs a table rewrite)

Lookup tables are appropriate when end users define new values at
runtime (categories, tags). None of our enums are user-extensible.
Converting to lookups would add a JOIN to every query that filters on
status or type, for zero benefit.

If a future requirement adds user-defined values (e.g. "neighbourhood
ratings"), that single domain gets a lookup table. The existing enums
stay.

### #13 Arabic search backend (Meilisearch / OpenSearch / Typesense) — DEFERRED

The reviewer's own note: "For MVP your current setup is absolutely
acceptable." Agreed. Phase 5 includes a perf check; if Arabic relevance
is poor at that point, we evaluate Meilisearch (cheapest to operate)
without changing the public API.

The current setup — `pg_trgm` on `title_ar` plus a generated tsvector
that uses the `simple` configuration for Arabic and `english` for
English — handles "starts with", "contains", and short-query autocomplete
adequately. We can always layer a real Arabic stemmer (e.g.
`zemberek-postgres`) before reaching for a separate search service.

### #14 `page_views_daily` composite PK — REJECTED (with mitigation)

The reviewer flagged NULL behaviour and cardinality explosion. The
composite PK
`(date, property_id, locale, country, region)` is the natural key of
the dimension/measure model — it IS the row. A surrogate id +
unique-on-the-same-columns adds a column and an index without removing
either listed concern.

**Mitigation:** I set `country` and `region` to `NOT NULL DEFAULT ''`
in 0003. The nightly rollup function will `COALESCE(country, '')` and
`COALESCE(region, '')` at INSERT time. That removes the "NULL behaviour"
risk the reviewer flagged.

Cardinality is bounded by `dates * properties * 2 locales * <small N
countries> * <small N regions>`. With 200 properties at 3-year retention
this is ~440k rows — happily fits in indexes.

### #15 Audit log archival — DEFERRED to Phase 5

A real concern, but premature optimisation for an MVP that has ~10
admins and ~5 mutations/day projected. Phase 5 ("Polish / perf / a11y
/ security") adds:

- Diff stored as JSONB containing changed fields only (already the
  intended behaviour — the `withAudit` HOF in `lib/audit.ts` will
  compute a fields-only delta, not a full row dump)
- A nightly pg_cron job moves audit rows older than 1 year to a
  compressed `admin_audit_log_archive` table
- Monitoring on `pg_total_relation_size('admin_audit_log')` with a
  500 MB alert

The schema does not need to change today.

---

## Items that were already in the plan (not raised here as new work)

- Materialised views for the analytics dashboard — land in
  `0004_views.sql`
- pg_cron schedule for MV refresh + page_views rollup + partition
  management — land in `0005_cron.sql`
- DB migration testing in CI — Phase 5

---

## Final disposition

| #   | Item                       | Status                                                                                    |
| --- | -------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | date_trunc index           | **APPLIED**                                                                               |
| 2   | DEFAULT partition          | **APPLIED**                                                                               |
| 3   | hero image redesign        | **APPLIED**                                                                               |
| 4   | updated_at consistency     | **APPLIED** on leads; intentionally omitted on `admin_invites` / `amenities` (documented) |
| 5   | featured_order constraints | **APPLIED**                                                                               |
| 6   | lead spam protection       | **APPLIED**                                                                               |
| 7   | admin privilege escalation | **APPLIED**                                                                               |
| 8   | composite filter index     | **APPLIED**                                                                               |
| 9   | view_count_total           | **APPLIED (removed)**                                                                     |
| 10  | double precision lat/lng   | **APPLIED**                                                                               |
| 11  | PostGIS                    | **DEFERRED** (YAGNI today)                                                                |
| 12  | enums -> lookup tables     | **REJECTED** (enums are correct here)                                                     |
| 13  | Arabic search backend      | **DEFERRED** (reviewer agreed MVP is OK)                                                  |
| 14  | page_views_daily PK        | **REJECTED** (mitigated with NOT NULL DEFAULT '')                                         |
| 15  | audit log archival         | **DEFERRED** to Phase 5                                                                   |
