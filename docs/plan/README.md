# Master Plan Mirror

[`MASTER_PLAN.md`](MASTER_PLAN.md) in this folder is a **version-
controlled mirror** of the approved Al Hewal implementation plan.

## Why a mirror

The AI assistant's plan-mode tooling stores the original at:

```
C:\Users\bino9\.claude\plans\lets-build-the-al-hewal-soft-horizon.md
```

That path is private to the owner's machine. Anyone else cloning the
repo, any session running elsewhere, and any human reviewer cannot
reach it. Mirroring the plan into the repo gives the project a
single, durable, peer-reviewable source of truth that travels with
the code.

## Which copy is canonical

For day-to-day work, **the in-repo copy
([`MASTER_PLAN.md`](MASTER_PLAN.md)) is canonical**. Reviewers,
contributors, and CI all read this one.

The home-dir copy remains as the working copy that the AI assistant's
plan tool auto-loads. When the plan changes, update both — the home-
dir version first (the assistant edits it during plan-mode sessions),
then sync the change into this folder via a docs PR.

## How to sync

Manually, from a developer machine that has the home-dir copy:

```powershell
# from al-hewal repo root
Copy-Item "$env:USERPROFILE\.claude\plans\lets-build-the-al-hewal-soft-horizon.md" `
          docs\plan\MASTER_PLAN.md -Force
git diff docs/plan/MASTER_PLAN.md     # review the change
# commit on a docs/* branch and open a PR
```

(Equivalent on bash: `cp ~/.claude/plans/lets-build-the-al-hewal-soft-horizon.md docs/plan/MASTER_PLAN.md`.)

## When to consult the plan

- A design or architecture question where the answer is not in the
  code or in [`../SESSION_HANDOFF.md`](../SESSION_HANDOFF.md).
- Before adding a new feature, to check what phase it belongs in.
- When a reviewer questions a decision, to point at the "Why" section.

The plan is the _what_ and the _why_. The code, the migrations, the
handoff doc, and `CLAUDE.md` are the _how_.
