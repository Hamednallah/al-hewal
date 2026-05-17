import 'server-only';

import { z } from 'zod';

/**
 * Typed environment variable loader for SERVER code.
 *
 * Parses `process.env` once with Zod, fails fast at startup if a required
 * variable is missing or malformed, and exposes a strongly-typed `env`
 * object the rest of the codebase imports.
 *
 * NEVER import this file from a client component — `server-only` will
 * surface a clear error at build time if you do. Public envs that the
 * browser needs are exposed via `clientEnv` below (which only reads
 * `NEXT_PUBLIC_*` keys that Next.js inlines at build).
 */
const serverSchema = z.object({
  // Required everywhere
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(40),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),

  // WhatsApp
  NEXT_PUBLIC_WHATSAPP_PHONE: z
    .string()
    .regex(/^[1-9][0-9]{6,14}$/, 'must be E.164 digits with no leading + (e.g. 9665XXXXXXXX)'),

  // Google Maps Embed (browser-exposed; restrict by HTTP referrer in the
  // Google Cloud Console before going live)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(20),

  // Vercel Blob (server only)
  BLOB_READ_WRITE_TOKEN: z.string().min(20).optional(),

  // Upstash Redis for rate limiting (server only)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(20).optional(),

  // Phase 5 - optional in earlier phases
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Lazily-parsed and cached env. Throwing inside module top-level evaluation
 * would crash the dev server every time you change an env file even
 * transiently; lazy parsing pushes the error to the first actual use
 * (e.g. a real request), which surfaces it cleanly in the route handler.
 */
let cachedServerEnv: ServerEnv | undefined;

export const env = new Proxy({} as ServerEnv, {
  get(_target, prop) {
    if (!cachedServerEnv) {
      const parsed = serverSchema.safeParse(process.env);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
          .join('\n');
        throw new Error(`Invalid server environment variables:\n${issues}`);
      }
      cachedServerEnv = parsed.data;
    }
    return cachedServerEnv[prop as keyof ServerEnv];
  },
});
