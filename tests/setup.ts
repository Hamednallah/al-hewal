// Env defaults FIRST — must execute before any module that pulls in
// `@/lib/env` (whose lazy Proxy throws when required vars are missing
// or malformed). Vitest setupFiles run before each test file is even
// evaluated, so doing this here guarantees the env is valid before
// any test file's top-level imports trigger an env access.
//
// In local dev these are already set via .env (Next + Vite both load
// it); on CI runners they're absent, which is why ??= falls back to
// these stub values. Real Supabase / Upstash / WhatsApp calls never
// happen in unit tests — the value just needs to satisfy the Zod
// regex in src/lib/env.ts.
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'a'.repeat(60);
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 's'.repeat(60);
// FORCE-overwrite (not ??=) because the CI workflow sets this to the
// example placeholder `9665XXXXXXXX`, which fails the digits-only
// regex in env.ts, AND because whatsapp.test.ts asserts on this exact
// value. Test determinism wins over the local .env fallback here.
process.env.NEXT_PUBLIC_WHATSAPP_PHONE = '966500000000';
// Phase 3 — admin cookie HMAC secret. Deterministic so the sign/verify
// round-trip in lib/auth/session.test.ts is reproducible across runs.
process.env.AUTH_COOKIE_SECRET ??= 'test-only-deterministic-cookie-secret-32+chars-for-vitest';

import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
