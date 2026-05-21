/**
 * Content-Security-Policy header construction. Pure functions only —
 * Edge-runtime safe (no Node `crypto`/`Buffer`).
 *
 * Called from `src/middleware.ts` per request. The master plan stages
 * CSP migration as **report-only first, then enforce**:
 *
 *   - **Today (PR 5-B):** every environment emits
 *     `Content-Security-Policy-Report-Only`. Violations show in the
 *     browser console (and at any report endpoint we configure) but
 *     nothing is blocked. This gives us observation time on a real
 *     deploy without breaking iteration or legitimate Next.js
 *     bootstrap scripts.
 *
 *   - **Follow-up PR (after observation):** swap the header name to
 *     `Content-Security-Policy` once we've confirmed zero violations
 *     against the deployed app for a week or two.
 *
 * Nonce-based enforcement was specced but stripped: Next.js 15 App
 * Router doesn't reliably propagate a per-request nonce to all inline
 * scripts it emits, and `'strict-dynamic'` without a working nonce
 * boot-script blocks the whole bundle. `script-src 'self'` covers the
 * same-origin chunks Next does emit; if observation later shows
 * inline scripts that need a nonce, we add it surgically.
 */

const ALLOWED_HOSTS = {
  // Vercel Blob (property images). Pattern matches any `<storeId>.public.blob.vercel-storage.com`.
  blob: 'https://*.public.blob.vercel-storage.com',
  // MapEmbed tile fetches — Carto Basemaps. The style.json lives at the
  // apex (`basemaps.cartocdn.com`); the tile chunks live on subdomains.
  cartoApex: 'https://basemaps.cartocdn.com',
  cartoTiles: 'https://*.basemaps.cartocdn.com',
  // Supabase HTTP + realtime websocket.
  supabaseHttp: 'https://*.supabase.co',
  supabaseWs: 'wss://*.supabase.co',
  // Sentry telemetry endpoints.
  sentry: 'https://*.sentry.io',
  sentryIngest: 'https://*.ingest.sentry.io',
};

/**
 * Compose the CSP header string. Always returned as a report-only
 * payload at the moment — the caller emits it under the
 * `Content-Security-Policy-Report-Only` header name. See file header
 * for the migration plan to an enforcing policy.
 *
 * `'unsafe-inline'` in `style-src` is unavoidable today — Tailwind v4
 * injects inline `<style>` blocks for runtime variants and Recharts
 * sets inline `style=` attributes on SVG nodes.
 *
 * `'unsafe-eval'` is added in development so Next's dev overlay + HMR
 * client (which use `eval` internally) keep working.
 */
export function buildCspHeader(isDev: boolean): string {
  const scriptSrc = isDev ? [`'self'`, `'unsafe-eval'`] : [`'self'`];

  const directives: Record<string, string[]> = {
    'default-src': [`'self'`],
    'script-src': scriptSrc,
    'style-src': [`'self'`, `'unsafe-inline'`],
    'img-src': [
      `'self'`,
      'data:',
      'blob:',
      ALLOWED_HOSTS.blob,
      ALLOWED_HOSTS.cartoApex,
      ALLOWED_HOSTS.cartoTiles,
    ],
    'font-src': [`'self'`, 'data:', ALLOWED_HOSTS.cartoApex, ALLOWED_HOSTS.cartoTiles],
    'connect-src': [
      `'self'`,
      ALLOWED_HOSTS.supabaseHttp,
      ALLOWED_HOSTS.supabaseWs,
      ALLOWED_HOSTS.cartoApex,
      ALLOWED_HOSTS.cartoTiles,
      ALLOWED_HOSTS.sentry,
      ALLOWED_HOSTS.sentryIngest,
      // Dev needs the websocket Next HMR opens on the same origin.
      ...(isDev ? ['ws:'] : []),
    ],
    'frame-src': [`'none'`],
    'object-src': [`'none'`],
    'base-uri': [`'self'`],
    'form-action': [`'self'`],
    'frame-ancestors': [`'none'`],
    // `upgrade-insecure-requests` is intentionally omitted in
    // report-only mode — the browser silently ignores it there
    // (the spec doesn't allow "report a would-be upgrade", only
    // enforce one). Adds a console warning per request otherwise.
    // The follow-up PR that promotes CSP to enforce should add
    // it back here.
  };

  return Object.entries(directives)
    .map(([directive, sources]) =>
      sources.length > 0 ? `${directive} ${sources.join(' ')}` : directive,
    )
    .join('; ');
}

/** Header NAME the caller uses to ship in **report-only** mode (today). */
export const CSP_REPORT_ONLY_HEADER_NAME = 'Content-Security-Policy-Report-Only';

/** Header NAME a follow-up PR will use once we promote to enforce. */
export const CSP_ENFORCE_HEADER_NAME = 'Content-Security-Policy';
