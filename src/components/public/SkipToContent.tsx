import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';

/**
 * Skip-to-content link. The first focusable element in the page tab order.
 * Hidden off-screen until keyboard focus reveals it (WCAG 2.4.1 Bypass
 * Blocks). The target id `#main-content` is set by the (public) layout's
 * <main>.
 */
export async function SkipToContent({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'public.common' });

  return (
    <a
      href="#main-content"
      className="bg-brass-400 text-teal-forest-700 sr-only z-50 px-4 py-2 text-sm font-bold uppercase tracking-[0.1em] focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
    >
      {t('skipToContent')}
    </a>
  );
}
