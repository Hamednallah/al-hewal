import createMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

/**
 * Root middleware.
 *
 * Today: only the next-intl locale negotiator. Visiting `/` redirects to
 * `/ar` (the default locale); visiting `/properties` redirects to
 * `/ar/properties`. Both `/ar/...` and `/en/...` pass through.
 *
 * Phase 1.9 will chain an admin-auth guard onto this middleware: any
 * `/<locale>/admin/*` path will check a signed session cookie before
 * letting the request through, redirecting unauthenticated requests to
 * `/<locale>/auth/login?next=<original-path>`.
 */
export default createMiddleware(routing);

export const config = {
  // Match every route EXCEPT Next internals, Vercel internals, static files
  // with a dot in the last path segment, and the API routes (which handle
  // their own locale via Accept-Language headers or explicit query params).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
