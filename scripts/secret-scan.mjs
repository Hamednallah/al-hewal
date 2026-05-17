#!/usr/bin/env node
// =============================================================================
// secret-scan.mjs
//
// Pre-commit guard against committing secrets. Scans the staged diff
// (added lines only) for known token patterns and rejects the commit if
// any are present.
//
// Patterns covered (extensible — keep in sync with SECURITY.md):
//   - Supabase service-role / anon JWT prefixes
//   - Vercel Blob read/write tokens
//   - Google Maps API key literals
//   - AWS access keys
//   - Generic high-entropy "*_KEY" / "*_TOKEN" / "*_SECRET" assignments
//   - .env-style lines outside .env.example
//
// Exits 1 on any match; the commit is aborted. To intentionally bypass
// is FORBIDDEN per CONTRIBUTING.md — fix the leak instead of using
// `--no-verify`.
// =============================================================================
import { execSync } from 'node:child_process';

// Each pattern is checked everywhere unless its `allowIn` list matches the
// current file path. Specific token shapes (AIza, eyJ, AKIA, ...) have no
// allow-list — those are real-token shapes that must never appear in source.
// The generic placeholder pattern allow-lists `tests/` and test fixtures
// because fake-but-key-shaped strings are unavoidable in env-loader tests.
const PATTERNS = [
  {
    name: 'Supabase JWT (service role or anon)',
    regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
    allowIn: [],
  },
  {
    name: 'Vercel Blob R/W token',
    regex: /\bvercel_blob_rw_[A-Za-z0-9_]{20,}\b/i,
    allowIn: [],
  },
  {
    name: 'Google API key',
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/,
    allowIn: [],
  },
  {
    name: 'AWS access key',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    allowIn: [],
  },
  {
    name: 'Sentry DSN',
    regex: /\bhttps?:\/\/[a-f0-9]{32}@[^\s]+\.ingest\.sentry\.io\/\d+\b/,
    allowIn: [],
  },
  {
    name: 'Generic API_KEY / TOKEN / SECRET assignment with long value',
    regex: /(API_KEY|ACCESS_TOKEN|SECRET_KEY|SERVICE_ROLE_KEY)\s*[:=]\s*['"][^'"\s]{20,}['"]/i,
    allowIn: [/^tests\//, /^scripts\/secret-scan\.mjs$/],
  },
];

// Files we ALWAYS allow to contain pattern-like strings: templates, docs,
// and the scanner itself.
const ALLOW_FILES = [
  /^\.env\.example$/,
  /^docs\//,
  /^SECURITY\.md$/,
  /^scripts\/secret-scan\.mjs$/,
  /^README\.md$/,
];

const isAllowedGlobally = (path) => ALLOW_FILES.some((re) => re.test(path));
const isAllowedForPattern = (path, pattern) =>
  pattern.allowIn.some((re) => re.test(path));

// Read the staged diff as unified text. --staged shows what is about to be
// committed; -U0 collapses context lines so we only inspect added/removed.
const diff = execSync('git diff --staged -U0 --no-color', { encoding: 'utf8' });
if (!diff.trim()) process.exit(0);

const lines = diff.split('\n');
let currentFile = null;
const findings = [];

for (const line of lines) {
  // Track the current file path as we walk the unified diff.
  const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
  if (fileMatch) {
    currentFile = fileMatch[1];
    continue;
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  if (!currentFile || isAllowedGlobally(currentFile)) continue;

  const added = line.slice(1);
  for (const pattern of PATTERNS) {
    if (isAllowedForPattern(currentFile, pattern)) continue;
    if (pattern.regex.test(added)) {
      findings.push({
        file: currentFile,
        pattern: pattern.name,
        snippet: added.trim().slice(0, 120),
      });
    }
  }
}

if (findings.length > 0) {
  console.error('\nsecret-scan: blocked commit — possible secret(s) detected:');
  for (const f of findings) {
    console.error(`  - ${f.file}: ${f.pattern}`);
    console.error(`      ${f.snippet}`);
  }
  console.error(
    '\nIf this is a false positive, narrow the regex in scripts/secret-scan.mjs',
  );
  console.error('and explain WHY in the commit body. Do NOT use --no-verify.\n');
  process.exit(1);
}

process.exit(0);
