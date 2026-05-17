import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

import type { Database } from './database.types';

/**
 * Service-role Supabase client.
 *
 * BYPASSES RLS. Use ONLY for:
 *   - inserting into page_views, whatsapp_clicks (analytics writes)
 *   - inserting into admin_audit_log (audit wrapper)
 *   - admin-only operations on auth.users (invite, deactivate)
 *   - any operation that legitimately needs to escape RLS
 *
 * NEVER import this file from a client component. The `server-only`
 * import at the top of this file will cause Next to throw at build
 * time if it is bundled to the browser. The eslint.config.mjs rule
 * `no-restricted-imports` enforces the same at lint time.
 *
 * `getSupabaseAdminClient()` is a singleton so each request reuses the
 * same connection pool entry. Do not call from middleware (edge runtime
 * doesn't support the websocket the realtime channel opens lazily).
 */
let cachedAdminClient: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabaseAdminClient() {
  if (!cachedAdminClient) {
    cachedAdminClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            'x-al-hewal-client': 'service-role-server',
          },
        },
      },
    );
  }
  return cachedAdminClient;
}
