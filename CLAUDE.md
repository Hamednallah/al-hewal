# CLAUDE.md — Al Hewal Project Context

> This file is read by AI assistants (Claude Code, Cursor, etc.) entering this
> repository. It captures the standing rules, conventions, and "do not touch"
> zones for the project. Keep it short. Update it when a convention changes.

## Project at a glance

Al Hewal is a Saudi real-estate developer. This repository delivers their
bilingual (Arabic / English) corporate website and admin Command Center.
Production target: Vercel, Supabase, and Vercel Blob — all on free tiers.

The full approved implementation plan lives at
`C:\Users\bino9\.claude\plans\lets-build-the-al-hewal-soft-horizon.md`.

## Hard rules

1. **Bilingual everywhere.** Public site AND admin are both bilingual. Every
   user-facing string lives in `src/i18n/messages/{ar,en}.json` under either
   `public.*` or `admin.*`. Never hardcode an English string in JSX.
2. **RTL is a first-class concern.** Use logical CSS properties only
   (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`). Audit any new shadcn
   component for `ml-*` / `mr-*` / `text-left` / `text-right` and rewrite.
   Mirror arrows and chevrons with `rtl:rotate-180`.
3. **Free-tier discipline.** Before adding anything that writes to the
   database, Vercel Blob, or invokes a function on every page load, ask:
   what is the quota cost? Document the answer in the PR.
4. **Security by default.** RLS on every table, Zod at every API boundary,
   no service-role key outside `lib/supabase/admin.ts`, no postinstall scripts
   without an allowlist entry, no committed secrets.
5. **No `any`.** TypeScript is strict. If you need an escape hatch, use
   `unknown` and narrow it.
6. **Test before claiming done.** Run `pnpm typecheck && pnpm lint && pnpm test`
   locally before pushing. The CI will reject anything that fails.

## Conventions

- **Package manager:** pnpm, pinned via `packageManager` in `package.json`.
  Never use `npm` or `yarn` against this repo.
- **Branches:** `feat/...`, `fix/...`, `chore/...`, `docs/...`, `test/...`.
  Direct push to `main` is forbidden after the initial scaffolding.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, etc.). One
  logical change per commit. The body explains _why_. No co-author trailers.
- **PRs:** one per phase sub-task. Body includes scope, screenshots for UI,
  test plan, free-tier impact, new env vars.
- **File size:** target 200-400 lines per file, hard cap 800. If a file gets
  larger, split by responsibility.
- **Function size:** target under 50 lines. If longer, extract.
- **Comments:** explain _why_, not _what_. Default to no comments. Only add
  when the reason is non-obvious.

## Design system

The design tokens are locked. See
`../stitch_alhewal_bilingual_corporate_website/al_hewal_architectura/DESIGN.md`
and `src/styles/globals.css`. Key invariants:

- **All corners are 0px.** No rounded buttons, no rounded cards, no rounded
  inputs. Sharp architectural rectangles only.
- **Palette:** Forest Teal `#002B2B` (primary structure), Brass `#D4B982`
  (CTAs and decorative accents only), Off-White `#F9F9F9` (canvas), Charcoal
  `#2D2D2D` (body text).
- **Brass contrast rule:** brass on teal is fine (7.8:1). Brass on off-white
  is **not** (1.9:1, fails AA). Never use brass for body text on light
  backgrounds.
- **Fonts:** IBM Plex Sans for Latin, IBM Plex Sans Arabic for Arabic. Line
  height 1.8 for Arabic, 1.6 for Latin — applied via `:lang(ar)`.

## Critical files

- `src/middleware.ts` — next-intl chain + admin auth guard. Cache-cookie
  reads to stay under the function-invocation budget.
- `src/lib/supabase/admin.ts` — service-role client, `import 'server-only'`.
  Never import from a client component.
- `src/lib/blob.ts` — Vercel Blob + sharp resize/AVIF/WebP/EXIF-strip
  pipeline.
- `src/app/api/whatsapp/track/route.ts` — rate-limited, audited, 302 to
  `wa.me`. This is THE primary conversion endpoint. Treat it with care.
- `supabase/migrations/*.sql` — append-only **after a migration has been applied to a shared database** (staging, production, or any teammate's local). Until then, in-place edits are not just allowed but _preferred_ — a fresh `pnpm supabase start` re-runs every migration from scratch, so a bug in an early file blocks everything that follows. The rule kicks in the moment the migration touches a DB that isn't yours to wipe.

## What not to do

- Do not `npm install` or `yarn add` anything; use `pnpm add` with an exact
  version pinned and write a rationale in the PR.
- Do not introduce a new client-side state store; the data already lives in
  Supabase and the URL.
- Do not add a global CSS reset on top of Tailwind v4's preflight.
- Do not log raw IPs, raw phone numbers, or raw emails to console or to
  Sentry. Use the PII scrubber in `lib/audit.ts`.
- Do not call Supabase from middleware on every request. Use the signed
  cookie cache.
- Do not skip the pre-commit hook (`--no-verify`). If it fails, fix the
  underlying problem.
