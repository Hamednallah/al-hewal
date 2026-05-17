'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from './database.types';

/**
 * Browser-side Supabase client backed by the anon key.
 *
 * Created lazily per call site (cheap — internal singleton in @supabase/ssr).
 * RLS policies apply. Service-role operations must NEVER happen in the
 * browser — use a server action or route handler instead.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing at build time',
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
