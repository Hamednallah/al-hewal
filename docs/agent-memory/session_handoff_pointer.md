---
name: session-handoff-pointer
description: Every new session on the Al Hewal project must open al-hewal/docs/SESSION_HANDOFF.md BEFORE doing anything else — it carries the full multi-PR context that would otherwise be lost
metadata:
  node_type: memory
  type: reference
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

The user explicitly asked for a handoff doc to avoid context-window compaction loss across sessions. The single source of truth for "where are we now / what's next / which decisions are locked" is:

**`d:\Work\Projects\AL-Hewal\al-hewal\docs\SESSION_HANDOFF.md`**

When you start a fresh session on this project:

1. Read `SESSION_HANDOFF.md` end-to-end — it includes the merged-PR ledger, the next PR's spec, all locked decisions, working agreement, repo settings, env vars, and how to resume.
2. Verify nothing has drifted: `git log --oneline -5` should match the "Main HEAD" stated at the top of SESSION_HANDOFF.md. If not, the handoff is stale — read the latest commits to reconcile.
3. THEN start working.

This memory exists so the index in `MEMORY.md` (loaded into every session's context) reminds you to open the handoff first. The handoff itself is the canonical, full-detail document.

Update SESSION_HANDOFF.md at the end of every Phase (or whenever the user asks). Keep it living — a stale handoff is worse than no handoff. See [[project_al_hewal_overview]].
