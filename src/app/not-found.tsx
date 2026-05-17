import Link from 'next/link';

/**
 * Top-level not-found page. Reached when a request hits a URL that doesn't
 * start with a valid locale prefix (e.g. `/foo/bar`). next-intl's middleware
 * would normally redirect to the default locale, but for any path the
 * middleware doesn't rewrite (notably top-level static files that don't
 * exist), this page renders without locale context.
 *
 * Returns a minimal HTML document because there is no <html> wrapper from
 * the locale layout at this level — we cannot rely on the design tokens or
 * Tailwind classes here, hence inline styles.
 */
export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl">
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
