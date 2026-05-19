'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Admin-side language switcher.
 *
 * Mirrors `src/components/public/LangSwitcher.tsx` — preserves the
 * current pathname (including the `/admin/...` segment) and flips the
 * locale prefix. The master plan calls this out explicitly: "admin
 * sidebar shows a language switcher" — without it admins navigating
 * between bilingual surfaces have to hand-edit the URL.
 *
 * Per-admin saved preference (`admins.language_pref` column) is
 * intentionally deferred — the URL is the source of truth today;
 * persistence lands when the Admin Management screen (master plan
 * screen 9) ships and admins have a profile to write to.
 *
 * Client component because `usePathname` reads from the React router.
 */
type AdminLangSwitcherProps = {
  className?: string;
};

export function AdminLangSwitcher({ className }: AdminLangSwitcherProps) {
  const activeLocale = useLocale() as Locale;
  const otherLocale = (
    activeLocale === routing.defaultLocale ? routing.locales[1] : routing.defaultLocale
  ) as Locale;

  const pathname = usePathname();
  const t = useTranslations('admin.common');

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      hrefLang={otherLocale}
      className={cn(
        'text-canvas/80 hover:text-brass-400 inline-flex items-center text-xs font-bold tracking-[0.18em] uppercase transition-colors duration-200',
        className,
      )}
      aria-label={t('languageSwitch')}
    >
      {t('languageSwitch')}
    </Link>
  );
}
