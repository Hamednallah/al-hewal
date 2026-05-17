---
name: project-seed-local-only
description: supabase/seed.sql is LOCAL ONLY. Never push to remote project (gvjmnwsqaymkxcsabjur). The remote/production catalog stays empty until Phase 3 admin adds real properties via the wizard
metadata:
  node_type: memory
  type: project
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

The owner decided to keep `supabase/seed.sql` strictly local during Phase 2. Local Docker Supabase (`pnpm supabase start` / `pnpm supabase db reset`) loads the 4 fixture properties (Al Dana 21, Al Yasmin 7, Al Narjis 204, Al Malqa block). The remote Supabase project does NOT get the seed.

**Why:** the owner wants the production catalog to be empty until real properties are uploaded via the Phase 3 admin "Add New Property" wizard. Fixture data on production would look unprofessional, and removing it post-launch is friction.

**How to apply:**

- Every public page in Phase 2 (home featured carousel, catalog, property detail) MUST handle empty / not-found gracefully:
  - Featured carousel: render nothing (or a "more projects coming soon" placeholder) when `getFeaturedProperties()` returns `[]`.
  - Catalog: render an empty-state component instead of an empty grid.
  - Property detail: return `notFound()` if the slug doesn't match a row.
- Data-fetch functions in `src/lib/data/properties.ts` MUST `try/catch` the Supabase call and return `[]` on connection error — otherwise CI build fails when its placeholder env points at a fake Supabase URL.
- Do NOT add `seed.sql` execution to the GitHub Actions workflow. Do NOT run `pnpm supabase db push` against the linked remote with seed flags. Do NOT use `pnpm supabase db reset --linked`.
- Documentation in docs/PHASE_1_SUMMARY.md and docs/POST_DEPLOY_CHECKLIST.md should reflect this: local devs see seed data; reviewers viewing the deployed preview see empty state until Phase 3 wires up the admin.

See [[project_al_hewal_overview]].
