---
name: feedback-github-check-names
description: 'When documenting GitHub branch-protection setup, the "required status checks" picker uses the JOB DISPLAY NAME (the `name:` field), never the YAML job key. Always quote the display name in setup docs'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

In PHASE_1_SUMMARY.md section C I told the user to type `verify` and `e2e` into the required-status-check picker. Those are the YAML job KEYS in `.github/workflows/ci.yml` (`jobs.verify:`, `jobs.e2e:`). GitHub's picker only shows what's in the `name:` field of each job — which I had set to `Lint, typecheck, test, build` and `Playwright (chromium)`. The user hit the friction during real setup and pushed back.

**Why:** the JOB KEY is invisible to anyone using the GitHub UI. The DISPLAY NAME is what shows in:

- The branch protection picker
- The PR "checks" UI
- The Actions tab run history
- The required-check status badge

If I describe the wrong one, the user follows the doc, can't find what I told them to type, and either gives up or has to come back. Either way they lose trust in the doc.

**How to apply:** for every "required check" / "status check" / "GitHub Actions visible name" in any setup doc:

1. Open the actual `name:` field of the relevant job in `.github/workflows/*.yml`
2. Quote that string verbatim, in backticks, with no paraphrase
3. Add a "if the name does not appear in the dropdown" recovery note — GitHub only suggests checks it has seen complete at least once on the target branch, so a brand-new repo needs one successful run first

Same principle applies to other UI-driven external integrations (Vercel "Build Command" picker, Supabase Studio table names, etc.) — always quote the literal label, never the internal key. See [[feedback_hand_held_setup]].
