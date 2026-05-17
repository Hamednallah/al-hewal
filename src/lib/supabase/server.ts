import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env } from '@/lib/env';

import type { Database } from './database.types';

/**
 * Server-side Supabase client backed by the anon key.
 *
 * Uses Next.js cookie store so Supabase Auth session is persisted across
 * server components, route handlers, server actions, and middleware.
 *
 * All RLS policies apply — this client respects them. For service-role
 * operations (audit log writes, page_view inserts, admin invitations),
 * use `lib/supabase/admin.ts` instead.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `cookies().set` may be called in a server component context where
          // setting cookies is not allowed. In that case the middleware will
          // have already refreshed the session, so we can safely ignore.
        }
      },
    },
  });
}
