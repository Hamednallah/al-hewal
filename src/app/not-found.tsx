import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Bilingual 404.
 *
 * Reached when:
 *   - the URL doesn't start with a valid locale prefix
 *   - a locale-prefixed page calls `notFound()` without its own
 *     not-found.tsx (Next 15 doesn't reliably pick up not-found.tsx
 *     inside a route group like `[locale]/(public)/`, so this global
 *     file is the single source of truth for missing pages)
 *
 * Renders BOTH Arabic and English in parallel — per the explicit
 * Phase 2 wrap UX request: "the 404 page display both English and
 * Arabic text". Each block carries its own `lang` + `dir` so screen
 * readers switch correctly. Layout is intentionally centered, no
 * inline-start/inline-end bias, so the page reads identically in
 * either browsing direction.
 *
 * Inline styles because this file owns its own `<html>` wrapper —
 * the design tokens in globals.css live behind a Tailwind layer
 * that the global not-found.tsx isn't wrapped by. Numeric values
 * map directly to the @theme palette in src/styles/globals.css.
 */

export const metadata: Metadata = {
  title: 'الصفحة غير موجودة · Page not found · Al Haual',
};

const COLOR = {
  teal: '#002b2b',
  tealDeep: '#001a1a',
  brass: '#d4b982',
  brassMuted: '#c5a059',
  canvas: '#f9f9f9',
  canvasMuted: 'rgba(249, 249, 249, 0.78)',
  rule: 'rgba(212, 185, 130, 0.25)',
};

export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>الصفحة غير موجودة · Page not found · Al Haual</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: COLOR.teal,
          color: COLOR.canvas,
          fontFamily:
            "'Tajawal', 'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Brand bar — logo image; centered to honour the same "no
            inline-start/end bias" rule the footer follows. */}
        <header
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${COLOR.rule}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Link
            href="/ar"
            aria-label="Al Haual · الحوال"
            style={{ display: 'inline-block', lineHeight: 0 }}
          >
            {/* Plain <img>, not next/image — this route renders its own
                <html> outside the App Router image pipeline. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="Al Haual · الحوال"
              width={64}
              height={64}
              style={{ height: 56, width: 'auto', display: 'block', borderRadius: 8 }}
            />
          </Link>
        </header>

        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
          }}
        >
          <div style={{ width: '100%', maxWidth: 980, textAlign: 'center' }}>
            {/* Big 404 + brass under-rule. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 24,
                marginBottom: 48,
                justifyContent: 'center',
              }}
              aria-hidden="true"
            >
              <p
                style={{
                  fontSize: 'clamp(72px, 14vw, 144px)',
                  lineHeight: 1,
                  margin: 0,
                  fontWeight: 700,
                  color: COLOR.brass,
                }}
              >
                404
              </p>
              <span
                style={{
                  display: 'inline-block',
                  height: 4,
                  width: 'clamp(60px, 14vw, 200px)',
                  backgroundColor: COLOR.brass,
                }}
              />
            </div>

            {/* Two columns — AR + EN side-by-side on tablet+, stacked on
                mobile via a media query. */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 32,
                marginBottom: 40,
              }}
            >
              {/* Arabic block */}
              <div lang="ar" dir="rtl" style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontSize: 12,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: COLOR.brassMuted,
                    margin: '0 0 12px',
                  }}
                >
                  صفحة غير موجودة
                </p>
                <h1
                  style={{
                    fontSize: 'clamp(26px, 4vw, 36px)',
                    margin: '0 0 16px',
                    fontWeight: 600,
                    lineHeight: 1.3,
                    color: COLOR.canvas,
                  }}
                >
                  هذه الصفحة لم نعد ننشرها
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 16,
                    lineHeight: 1.8,
                    color: COLOR.canvasMuted,
                  }}
                >
                  ربما تم نقل العقار، أو لم يعد الرابط صالحاً. تصفح المشاريع المتاحة أو تواصل معنا.
                </p>
              </div>

              {/* English block */}
              <div lang="en" dir="ltr" style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontSize: 12,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: COLOR.brassMuted,
                    margin: '0 0 12px',
                  }}
                >
                  Page not found
                </p>
                <h2
                  style={{
                    fontSize: 'clamp(26px, 4vw, 36px)',
                    margin: '0 0 16px',
                    fontWeight: 600,
                    lineHeight: 1.3,
                    color: COLOR.canvas,
                  }}
                >
                  This page isn&rsquo;t available
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: COLOR.canvasMuted,
                  }}
                >
                  The property may have moved, or the link is no longer valid. Browse the current
                  catalog or get in touch.
                </p>
              </div>
            </div>

            {/* CTAs — pairs for both locales, centered. */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                justifyContent: 'center',
              }}
            >
              <Cta href="/ar/properties" primary lang="ar">
                تصفح العقارات
              </Cta>
              <Cta href="/ar" lang="ar">
                العودة للرئيسية
              </Cta>
              <Cta href="/en/properties" primary lang="en">
                Browse Properties
              </Cta>
              <Cta href="/en" lang="en">
                Back to Home
              </Cta>
            </div>
          </div>
        </main>

        <footer
          style={{
            padding: '20px 24px',
            borderTop: `1px solid ${COLOR.rule}`,
            textAlign: 'center',
            fontSize: 12,
            color: COLOR.canvasMuted,
          }}
        >
          © {new Date().getFullYear()} الحوال · Al Haual Real Estate Development &amp; Investment
        </footer>
      </body>
    </html>
  );
}

function Cta({
  href,
  children,
  primary = false,
  lang,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  lang: 'ar' | 'en';
}) {
  return (
    <Link
      href={href}
      lang={lang}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 24px',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        textDecoration: 'none',
        border: `2px solid ${COLOR.brass}`,
        backgroundColor: primary ? COLOR.brass : 'transparent',
        color: primary ? COLOR.teal : COLOR.brass,
        transition: 'background-color 200ms, color 200ms',
      }}
    >
      {children}
    </Link>
  );
}
