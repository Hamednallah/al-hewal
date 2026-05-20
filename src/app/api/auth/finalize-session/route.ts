import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/finalize-session
 *
 * Companion to `/auth/recovery/page.tsx` + `RecoveryHandler.tsx`.
 *
 * Establishes a Supabase Auth session from either:
 *   - `{ access_token, refresh_token }` — implicit flow case. Supabase's
 *     `inviteUserByEmail` / `resetPasswordForEmail` on this project
 *     emit implicit-flow tokens that land in the URL fragment of our
 *     `/auth/recovery` callback. The client component extracts them
 *     from `window.location.hash` and forwards them here.
 *   - `{ code }` — PKCE flow case. Legacy back-compat for projects /
 *     emails that come through with `?code=…` in the query.
 *
 * Either input lands at `supabase.auth.setSession` /
 * `exchangeCodeForSession` on a Route-Handler-scoped Supabase client.
 * Route Handlers (unlike Server Components) can write cookies, so the
 * SSR adapter's cookie set succeeds and the rest of the app
 * (server actions, RSC reads of `getUser`) sees the new session
 * immediately.
 *
 * Security:
 *   - Tokens / code are NEVER logged. The route only logs the
 *     supabase error type on failure, never the secret material.
 *   - The POST is same-origin only — the browser's CORS rules block
 *     external sites from invoking it. There's no need for a CSRF
 *     token because no authenticated state exists yet (the whole
 *     point of this endpoint is to MINT the first authenticated
 *     state).
 *   - Validation is strict via Zod; malformed input is rejected
 *     with 400 before touching Supabase.
 */

const ImplicitSchema = z.object({
  access_token: z.string().min(1).max(8192),
  refresh_token: z.string().min(1).max(8192),
});

const PkceSchema = z.object({
  code: z.string().min(1).max(2048),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const implicit = ImplicitSchema.safeParse(body);
  if (implicit.success) {
    const { error } = await supabase.auth.setSession({
      access_token: implicit.data.access_token,
      refresh_token: implicit.data.refresh_token,
    });
    if (error) {
      console.warn('[finalize-session] setSession rejected tokens:', error.name);
      return NextResponse.json({ ok: false, error: 'invalid_tokens' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const pkce = PkceSchema.safeParse(body);
  if (pkce.success) {
    const { error } = await supabase.auth.exchangeCodeForSession(pkce.data.code);
    if (error) {
      console.warn('[finalize-session] exchangeCodeForSession rejected code:', error.name);
      return NextResponse.json({ ok: false, error: 'invalid_code' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
}
