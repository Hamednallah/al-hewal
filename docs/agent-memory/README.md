# Agent Memory Mirror

The `.md` files in this folder are **version-controlled mirrors** of
the AI assistant's persistent project memories. They live in the repo
so they travel with the code, get peer-reviewed alongside features,
and survive any single machine going away.

## What a memory is

Short, focused notes the assistant accumulates about working
agreements and project context — things like "the user is new to
Vercel, walk them through it click-by-click" or "the seed file is
local-only, never push to remote". The assistant reads them at the
start of every session so behaviours stay consistent across chats.

| Memory                                                               | Type      | What it captures                                      |
| -------------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| [`session_handoff_pointer.md`](session_handoff_pointer.md)           | reference | Read `docs/SESSION_HANDOFF.md` FIRST at session start |
| [`project_al_hewal_overview.md`](project_al_hewal_overview.md)       | project   | Stack, constraints, phases, key file paths            |
| [`project_arabic_first_routing.md`](project_arabic_first_routing.md) | project   | `localeDetection: false` is intentional               |
| [`project_seed_local_only.md`](project_seed_local_only.md)           | project   | `supabase/seed.sql` never pushed to remote            |
| [`feedback_hand_held_setup.md`](feedback_hand_held_setup.md)         | feedback  | External-service setup must be click-by-click         |
| [`feedback_monitor_ci.md`](feedback_monitor_ci.md)                   | feedback  | Use `gh run watch` after every push                   |
| [`feedback_pushback_on_reviews.md`](feedback_pushback_on_reviews.md) | feedback  | Write a disposition doc; push back where correct      |
| [`feedback_github_check_names.md`](feedback_github_check_names.md)   | feedback  | Quote literal job display name in setup docs          |
| [`MEMORY.md`](MEMORY.md)                                             | index     | One-line summary of each memory above                 |

## Why a mirror

The assistant's auto-memory system loads from a fixed home-directory
path:

```
C:\Users\bino9\.claude\projects\d--Work-Projects-AL-Hewal\memory\
```

That path is private to the owner's machine. If a different developer,
a different machine, or a future AI assistant joins the project, they
need the same context — but cannot reach the home-dir copy. Mirroring
gives the project a durable copy under version control.

## Which copy is canonical

- **The home-dir copy is what the assistant reads at session start.**
  The assistant's tooling is hardcoded to that path.
- **The in-repo copy is what humans (and reviewers) read.** It is also
  the safety net if the home-dir copy is ever lost.

When a memory changes, the assistant updates the home-dir copy first
(its tools write there). Mirror the change into this folder via a
short docs PR so the diff is reviewable. The
[`SESSION_HANDOFF.md`](../SESSION_HANDOFF.md) at the end of every phase
should re-sync as part of its update.

## How to sync

From a developer machine:

```powershell
# from al-hewal repo root
$src = "$env:USERPROFILE\.claude\projects\d--Work-Projects-AL-Hewal\memory"
Copy-Item "$src\*.md" docs\agent-memory\ -Force
git diff docs/agent-memory/    # review
# commit on a docs/* branch and PR
```

Bash equivalent:

```bash
cp ~/.claude/projects/d--Work-Projects-AL-Hewal/memory/*.md docs/agent-memory/
```

## When to add a new memory

If you find yourself answering the same question across sessions, or
explaining a project-specific decision more than twice, write a new
memory. Use the existing files as templates — they're all under 50
lines and follow the same frontmatter shape (`name`, `description`,
`metadata.type` of `feedback` / `project` / `reference`).
