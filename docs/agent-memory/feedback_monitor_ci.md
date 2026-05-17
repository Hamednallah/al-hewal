---
name: feedback-monitor-ci
description: 'After pushing to GitHub, proactively monitor the CI run via gh CLI and report failures before the user has to ask'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

The user asked "what do you need to monitor [CI]" and then installed and authenticated `gh` CLI. This is an explicit invitation to use it after every push.

**Why:** in this session, CI failed on a Playwright test and the user had to manually paste the log into chat. That round-trip is wasted time when `gh run watch` does it directly. The user wants CI failures noticed and addressed in the same session, not in the next.

**How to apply:** after every `git push`:

1. `gh run list --branch <branch> --limit 1` to find the run id
2. `gh run watch <id>` (or `gh run watch` for the most recent) to block until complete
3. If it fails: `gh run view <id> --log-failed` to fetch only the failing step output, then fix
4. Do NOT wait for the user to notice the red badge on GitHub

If `gh` is not available in a future session, fall back to asking the user to paste the run log. Don't pretend the push succeeded just because git push exited 0 — that only proves the commit reached GitHub, not that CI is green.
