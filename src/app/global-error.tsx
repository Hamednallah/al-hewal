'use client';

import type { Metadata } from 'next';

/**
 * Bilingual 500 / root-level error boundary.
 *
 * Caught here when:
 *   - the root `app/layout.tsx` itself throws
 *   - an error escapes a locale-segment `error.tsx` (the locale
 *     boundary couldn't recover)
 *
 * Because `app/layout.tsx` is the file that failed, this component
 * must render its OWN `<html>` + `<body>`. That's the Next 15
 * contract for `global-error.tsx`. Inline styles only — no Tailwind
 * processing reaches this surface for the same reason as
 * `not-found.tsx`.
 *
 * Bilingual side-by-side display (Arabic first, English second)
 * because the locale context may have been part of what failed.
 * Screen readers switch language thanks to per-block `lang` +
 * `dir` attributes.
 *
 * `reset()` is the Next-provided callback to retry the render. The
 * "Try again" button calls it. If the underlying error is
 * deterministic, the second attempt fails the same way — that's
 * acceptable; manual reload from the address bar gets the user
 * out of the loop.
 *
 * Sentry capture lands in PR 5-B alongside the SDK install.
 */

export const metadata: Metadata = {
  title: 'حدث خطأ · Something went wrong · Al Haual',
};

const COLOR = {
  teal: '#002b2b',
  brass: '#d4b982',
  brassMuted: '#c5a059',
  canvas: '#f9f9f9',
  canvasMuted: 'rgba(249, 249, 249, 0.78)',
  rule: 'rgba(212, 185, 130, 0.25)',
};

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>حدث خطأ · Something went wrong · Al Haual</title>
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
        <header
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${COLOR.rule}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt="Al Haual · الحوال"
            width={64}
            height={64}
            style={{ height: 56, width: 'auto', display: 'block', borderRadius: 8 }}
          />
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
          <div style={{ width: '100%', maxWidth: 880, textAlign: 'center' }}>
            <p
              style={{
                fontSize: 'clamp(56px, 12vw, 120px)',
                lineHeight: 1,
                margin: '0 0 32px',
                fontWeight: 700,
                color: COLOR.brass,
              }}
              aria-hidden="true"
            >
              500
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 32,
                marginBottom: 40,
              }}
            >
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
                  حدث خطأ غير متوقع
                </p>
                <h1
                  style={{
                    fontSize: 'clamp(26px, 4vw, 36px)',
                    margin: '0 0 16px',
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}
                >
                  نواجه عطلاً مؤقتاً
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 16,
                    lineHeight: 1.8,
                    color: COLOR.canvasMuted,
                  }}
                >
                  لقد سجّلنا المشكلة. أعد المحاولة بعد قليل، أو اتصل بنا مباشرةً عبر واتساب.
                </p>
              </div>

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
                  Something went wrong
                </p>
                <h2
                  style={{
                    fontSize: 'clamp(26px, 4vw, 36px)',
                    margin: '0 0 16px',
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}
                >
                  We hit a temporary issue
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: COLOR.canvasMuted,
                  }}
                >
                  The error has been logged. Try again in a moment, or reach us directly on
                  WhatsApp.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  display: 'inline-block',
                  padding: '12px 28px',
                  fontSize: 14,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  border: `2px solid ${COLOR.brass}`,
                  backgroundColor: COLOR.brass,
                  color: COLOR.teal,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                المحاولة مجدداً · Try again
              </button>
              {/* Plain <a> intentional — global-error.tsx renders its
                  own <html> outside the App Router, so next/link
                  cannot work here. */}
              {/* eslint-disable @next/next/no-html-link-for-pages */}
              <a
                href="/ar"
                style={{
                  display: 'inline-block',
                  padding: '12px 28px',
                  fontSize: 14,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  border: `2px solid ${COLOR.brass}`,
                  backgroundColor: 'transparent',
                  color: COLOR.brass,
                  textDecoration: 'none',
                }}
                lang="ar"
              >
                الرئيسية
              </a>
              <a
                href="/en"
                style={{
                  display: 'inline-block',
                  padding: '12px 28px',
                  fontSize: 14,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  border: `2px solid ${COLOR.brass}`,
                  backgroundColor: 'transparent',
                  color: COLOR.brass,
                  textDecoration: 'none',
                }}
                lang="en"
              >
                Home
              </a>
              {/* eslint-enable @next/next/no-html-link-for-pages */}
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
