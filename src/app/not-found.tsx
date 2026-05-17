import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Top-level not-found page. Reached when a request hits a URL that doesn't
 * start with a valid locale prefix (e.g. `/foo/bar`), AND when a
 * locale-prefixed page calls notFound() without its own not-found.tsx
 * (e.g. an unknown property slug).
 *
 * Returns a minimal HTML document because there is no <html> wrapper from
 * the locale layout at this level — we cannot rely on the design tokens or
 * Tailwind classes here, hence inline styles.
 *
 * `metadata` provides the <title> the global layout would normally inject;
 * without it, axe-core flags `document-title` (WCAG 2.4.2) as serious.
 */
export const metadata: Metadata = {
  title: 'الصفحة غير موجودة · Page not found',
};

export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Inline <title> because this not-found.tsx renders its own
            <html> wrapper — there's no parent layout to inject one from
            the `metadata` export. axe-core flags `document-title`
            (WCAG 2.4.2) as serious without it. */}
        <title>الصفحة غير موجودة · Page not found · Al Hewal</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#002b2b',
          color: '#f9f9f9',
          fontFamily:
            "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '32rem', padding: '2rem' }}>
          <p
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#d4b982',
            }}
          >
            الحوال · Al Hewal
          </p>
          <h1 style={{ fontSize: '3rem', margin: '1rem 0', fontWeight: 700 }}>404</h1>
          <p style={{ fontSize: '1rem', opacity: 0.8 }}>الصفحة غير موجودة · Page not found</p>
          <p style={{ marginTop: '2rem', fontSize: '0.875rem' }}>
            <Link href="/ar" style={{ color: '#d4b982' }}>
              العودة للرئيسية / Go home
            </Link>
          </p>
        </div>
      </body>
    </html>
  );
}
