---
name: feedback-hand-held-setup
description: 'Whenever a doc tells the user to configure an external service (Vercel, Supabase, GitHub, Sentry, Upstash, GBP, Search Console, etc.), write it click-by-click with URLs and exact field values'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

The user is a first-time Vercel user (and likely first-time for several of the dev-ops tools we touch — Supabase CLI, GBP, Search Console, etc.). They explicitly said: "I didn't use vercel before so in PHASE_1_SUMMARY.md in manual setup, guide (take my hand) in all of them, and always do this in the future."

**Why:** they will follow the doc blind during a real handover or while exhausted. A doc that says "create a Vercel project" without telling them which button to click, which field to fill, and what the right value is will fail them — and they will not push back, they will guess and break things.

**How to apply:** for every "owner action" / "manual setup" step in any doc, include:

- The exact URL (`https://...`)
- "Click X" (where X is the literal button or menu label)
- Every field value to enter (use a table if more than 3 fields)
- What the success state looks like ("you should see Y")
- What to do if it fails (paste the error, or ping me)
- Total time estimate per section

Apply to PHASE_1_SUMMARY-style docs, POST_DEPLOY_CHECKLIST-style docs, README setup sections, and any inline "next step" instructions in commits or PRs. See [[project_al_hewal_overview]] for project scope.
