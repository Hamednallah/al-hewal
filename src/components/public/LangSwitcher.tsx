'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Language switcher.
 *
 * Renders a single link that flips between Arabic and English while
 * preserving the current pathname. Uses next-intl's locale-aware
 * `usePathname` so the returned path is locale-stripped, and the
 * locale-aware `Link` re-prefixes it with the target locale.
 *
 * Client component because `usePathname` reads from the React router.
 * The size is tiny (a single string + a Link), so this does not
 * meaningfully increase the client bundle.
 */
type LangSwitcherProps = {
  className?: string;
};

export function LangSwitcher({ className }: LangSwitcherProps) {
  const activeLocale = useLocale() as Locale;
  const otherLocale = (
    activeLocale === routing.defaultLocale ? routing.locales[1] : routing.defaultLocale
  ) as Locale;

  const pathname = usePathname();
  const t = useTranslations('public.common');

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      hrefLang={otherLocale}
      className={cn(
        'text-canvas/80 hover:text-brass-400 inline-flex items-center text-sm font-bold uppercase tracking-[0.2em] transition-colors duration-200',
        className,
      )}
      aria-label={t('languageSwitch')}
    >
      {t('languageSwitch')}
    </Link>
  );
}
