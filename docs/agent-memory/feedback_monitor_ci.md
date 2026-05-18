---
name: feedback-monitor-ci
description: 'User monitors GitHub Actions themselves — do NOT run `gh run watch` or background CI-watch loops. Wait for the user to report status/failures, then diagnose from their report.'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

The user monitors CI themselves and will tell me when a run completes (green or red). I MUST NOT spawn `gh run watch` background tasks, polling loops, or repeated `gh run list` checks after a push.

**Why:** background watches keep the session alive longer and re-invoke me on every CI notification, which on Opus burns expensive turns for streaming text I don't need. The user said explicitly: "always from now on, let me monitor the GitHub Actions and tell you." That call also flipped the prior policy in the original version of this memory (which had me running `gh run watch` after every push) — this version supersedes it.

**How to apply:**

1. After `git push`, **stop**. Don't run `gh run watch`. Don't poll `gh run list`. Don't schedule wakeups for CI.
2. Move on to the next thing the user asked for, OR end the turn with a clean status line ("PR #N pushed, auto-merge queued — ping me when CI reports back").
3. When the user reports a failure (e.g. "the CI failed"), THEN use `gh` to diagnose:
   - `gh run list --branch <branch> --limit 1` to find the latest run id (single command, single shot)
   - `gh run view <id> --log-failed` to fetch only the failing step
   - Fix, commit, push, stop again
4. If CI is green, the user typically says so or moves to the next task — no action needed from me.

The pattern is "push and wait for the user," not "push and babysit." Same applies to deployment status, preview URLs, and any other long-running external thing.

See also: [[reference_gh_cli_path]] for the gh.exe absolute-path quirk on this Windows machine.
