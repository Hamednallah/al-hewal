'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/**
 * Locale-scoped error boundary. Catches errors that escape page
 * components within `[locale]/*`. The root layout and locale layout
 * are still intact at this point, so this file just renders the
 * inner content — no `<html>` / `<body>` wrapper.
 *
 * Sentry capture lands in PR 5-B alongside the SDK install.
 *
 * The error message is intentionally locale-agnostic at the boundary
 * level: we don't surface the underlying error message to visitors.
 * The `digest` (Next-provided opaque ID) is the only thing we'd hand
 * to a support touchpoint.
 */

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocaleErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const t = useTranslations('public.error');
  const params = useParams<{ locale: string }>();
  const locale = params?.locale === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    // Surface the digest in dev logs so the error is easy to
    // correlate with server logs. PR 5-B replaces this with a
    // Sentry capture.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[LocaleErrorBoundary]', error.message, error.digest ?? '');
    }
  }, [error]);

  return (
    <main
      id="main-content"
      data-testid="locale-error-boundary"
      className="bg-canvas text-charcoal flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <p className="text-brass-700 mb-3 text-xs font-semibold tracking-[0.3em] uppercase">
        {t('eyebrow')}
      </p>
      <h1 className="text-teal-forest-700 mb-4 text-3xl font-semibold md:text-4xl">{t('title')}</h1>
      <p className="text-charcoal-muted mb-8 max-w-xl text-base leading-relaxed md:text-lg">
        {t('body')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="primary" size="md" onClick={() => reset()}>
          {t('retry')}
        </Button>
        <Button asChild variant="outline" size="md">
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
    </main>
  );
}
