---
name: project-al-hewal-overview
description: 'Al Hewal is a Saudi real-estate corporate website + admin Command Center. Strict reviewers, bilingual, free-tier infrastructure'
metadata:
  node_type: memory
  type: project
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

**Project:** Al Hewal (الحوال) — a Saudi real-estate developer's corporate website and admin dashboard. Real client deliverable, judged by a strict senior team lead.

**Stack:** Next.js 15 App Router + React 19 + TypeScript strict + Tailwind v4 + shadcn (Radix) + next-intl 4 + Supabase Postgres + Vercel + Vercel Blob + MapLibre+OSM (Phase 1-2; Google Maps Embed is an optional upgrade).

**Constraints that drive design:**

- Bilingual AR/EN end-to-end (public AND admin). Arabic is the default (`/` -> `/ar`).
- Free tier on Supabase (500MB DB, 1GB storage, 2GB egress, 50k MAU), Vercel (100GB bandwidth, 100k function invocations), Vercel Blob (5GB / 1GB egress), Upstash Redis (10k commands/day).
- The plan respects these quotas at every layer (partitioning, ISR, sharp resize, image caps, rate limits).
- WhatsApp click-through is THE primary conversion metric. Server-recorded -> redirect to wa.me.
- Admins are invite-only via Supabase Auth magic links. Super vs Standard tiers.

**Phased delivery:**

- Phase 1: foundations (scaffold, schema, RLS, CI, quality gates) - DONE
- Phase 2: public site (home, catalog, detail, WhatsApp tracking, SEO)
- Phase 3: admin listings + leads + property wizard + bilingual PDF
- Phase 4: admin users + invites + analytics + TOTP for super_admin
- Phase 5: a11y/perf/security polish + Sentry + PDPL consent + load test
- Phase 6: go-live (Search Console, GBP, Lighthouse, owner training) -- see al-hewal/docs/POST_DEPLOY_CHECKLIST.md

**Key project files:**

- Plan: `C:\Users\bino9\.claude\plans\lets-build-the-al-hewal-soft-horizon.md`
- Repo: `d:\Work\Projects\AL-Hewal\al-hewal\`
- Remote: https://github.com/Hamednallah/al-hewal.git
- Design source: `d:\Work\Projects\AL-Hewal\stitch_alhewal_bilingual_corporate_website\al_hewal_architectura\DESIGN.md`
- Mockups: `d:\Work\Projects\AL-Hewal\stitch_alhewal_bilingual_corporate_website\{home,property_*,admin_*}\code.html` + `screen.png`

Related: [[project_arabic_first_routing]], [[feedback_hand_held_setup]], [[feedback_monitor_ci]], [[feedback_pushback_on_reviews]]
