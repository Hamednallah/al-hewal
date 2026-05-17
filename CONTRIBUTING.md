# Contributing to Al Hewal

This document describes the contribution workflow for this repository. The
codebase is closed-source and proprietary to Al Hewal Real Estate Development
and Investment Company, so this guide is intended for the engineering team and
contracted developers.

## Workflow

1. **Pick a task.** Tasks come from the implementation plan in
   `docs/PROJECT_PLAN.md` (or the planning document referenced in
   `README.md`). Each phase is broken into PR-sized sub-tasks.
2. **Create a branch.** Name it `feat/<phase>-<slug>`, `fix/<slug>`,
   `chore/<slug>`, `docs/<slug>`, or `test/<slug>`. Never push directly to
   `main` (except for the initial scaffolding commit).
3. **Write the code.** Follow the conventions in `CLAUDE.md`. Add tests as
   you go — the 80% coverage gate in CI is non-negotiable.
4. **Run the local gate.** Before pushing:
   ```powershell
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   ```
5. **Commit.** Use Conventional Commits. One logical change per commit. The
   pre-commit hook will run Prettier, ESLint, and a secret scan. **Never use
   `--no-verify`.** If the hook fails, fix the underlying issue.
6. **Push and open a PR.** Use the PR template. Include:
   - Scope: what changed and why
   - Screenshots or screen recordings for any UI work, both `/ar` and `/en`
   - Test plan as a checklist
   - Free-tier impact note (new DB rows per pageview? new Blob writes? new
     function invocations? new third-party API calls?)
   - New environment variables, with where they were added (Vercel scope)
7. **Wait for CI.** All required checks must pass:
   - typecheck, lint, vitest with coverage gate, Playwright smoke, build
   - `pnpm audit signatures` and `pnpm audit --audit-level=high`
   - Secret scan
   - RLS regression test
8. **Get a review.** At least one approval from a maintainer.
9. **Squash-merge.** Use a Conventional Commit message for the squash.

## Adding a dependency

Adding a package is a security-relevant action. Follow these steps:

1. **Justify** — open the PR with a paragraph explaining why a new
   dependency is needed and why an existing one cannot serve the purpose.
2. **Vet** — check the package on Socket.dev. Verify:
   - Weekly download count > 10k for production deps (lower OK for dev deps
     with strong rationale)
   - Last release date older than 30 days (or pin to a version that is)
   - No install scripts (or, if there are, add to
     `pnpm.onlyBuiltDependencies` allowlist with a written reason)
   - Maintainer is a known, established entity
   - No recent security incidents
3. **Pin** — use an exact version, no `^` or `~`.
4. **Install** — `pnpm add <name>@<version> --save-exact` (or `--save-dev`
   `--save-exact` for dev deps).
5. **Review the lockfile diff** in the PR. Unexpected transitive packages
   are a red flag.

## Adding an environment variable

1. Add it to `.env.example` with a comment explaining its purpose and where
   to obtain a value.
2. Add it to the appropriate Vercel environment scope (Production,
   Preview, Development) via the Vercel dashboard.
3. Document it in `SECURITY.md` if it is a secret (with the rotation
   cadence).
4. Reference it in code via a strongly-typed env loader (`src/lib/env.ts`),
   never directly via `process.env.NAME`.

## Reporting an issue

For non-security bugs, open a GitHub issue with reproduction steps, expected
vs. actual behaviour, and the affected route (including `/ar` vs `/en`).

For security issues, see `SECURITY.md`.
