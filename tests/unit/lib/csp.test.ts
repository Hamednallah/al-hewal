import { describe, expect, it } from 'vitest';

import { CSP_ENFORCE_HEADER_NAME, CSP_REPORT_ONLY_HEADER_NAME, buildCspHeader } from '@/lib/csp';

describe('buildCspHeader', () => {
  it('emits the directives in a single header value separated by "; "', () => {
    const csp = buildCspHeader(false);
    for (const directive of [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'frame-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
    ]) {
      expect(csp).toContain(directive);
    }
    // Joined with `; `, not newlines (single-line HTTP header value).
    expect(csp).not.toContain('\n');
  });

  it('production script-src is just self (no unsafe-eval, no inline)', () => {
    const csp = buildCspHeader(false);
    expect(csp).toMatch(/script-src 'self'(;| )/);
    expect(csp).not.toContain(`'unsafe-eval'`);
    expect(csp).not.toContain(`'unsafe-inline' 'self'`); // would mean inline is in script-src
  });

  it('development script-src allows unsafe-eval for the Next dev overlay', () => {
    const csp = buildCspHeader(true);
    expect(csp).toMatch(/script-src 'self' 'unsafe-eval'/);
  });

  it('style-src always allows unsafe-inline (Tailwind v4 + Recharts inline styles)', () => {
    expect(buildCspHeader(false)).toMatch(/style-src 'self' 'unsafe-inline'/);
    expect(buildCspHeader(true)).toMatch(/style-src 'self' 'unsafe-inline'/);
  });

  it('img-src allows Vercel Blob and Google Maps static hosts', () => {
    const csp = buildCspHeader(false);
    expect(csp).toContain('https://*.public.blob.vercel-storage.com');
    expect(csp).toContain('https://maps.gstatic.com');
    expect(csp).toContain('https://www.google.com');
  });

  it('frame-src allows the Google Maps embed origin', () => {
    const csp = buildCspHeader(false);
    expect(csp).toMatch(/frame-src https:\/\/www\.google\.com/);
  });

  it('connect-src allows Supabase HTTP + websocket and Sentry ingest', () => {
    const csp = buildCspHeader(false);
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).toContain('wss://*.supabase.co');
    expect(csp).toContain('https://*.sentry.io');
    expect(csp).toContain('https://*.ingest.sentry.io');
  });

  it('connect-src allows ws: in dev only (Next HMR)', () => {
    expect(buildCspHeader(true)).toContain('ws:');
    expect(buildCspHeader(false)).not.toContain(' ws:');
  });

  it('object-src and frame-ancestors are locked down', () => {
    const csp = buildCspHeader(false);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
  });

  it('omits upgrade-insecure-requests in report-only mode (browser-warned otherwise)', () => {
    // The directive cannot be reported, only enforced. Including it in a
    // report-only policy produces a console warning on every page load.
    // Re-add when the policy is promoted to `Content-Security-Policy`.
    expect(buildCspHeader(false)).not.toContain('upgrade-insecure-requests');
    expect(buildCspHeader(true)).not.toContain('upgrade-insecure-requests');
  });
});

describe('CSP header names', () => {
  it('exports both report-only and enforce names', () => {
    expect(CSP_REPORT_ONLY_HEADER_NAME).toBe('Content-Security-Policy-Report-Only');
    expect(CSP_ENFORCE_HEADER_NAME).toBe('Content-Security-Policy');
  });
});
