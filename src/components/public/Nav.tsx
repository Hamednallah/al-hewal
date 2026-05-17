import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

import { LangSwitcher } from './LangSwitcher';
import { MobileDrawer } from './MobileDrawer';

/**
 * Top navigation bar.
 *
 * Server component: structure, brand mark, link list, locale switcher.
 * The mobile drawer is a client component for state; the lang switcher
 * is a client component because it reads the active path.
 *
 * Visual: solid Forest Teal background by default. PR 2.2 (home) will
 * add a "transparent on hero, solid on scroll" client wrapper that
 * decorates this <Nav> with the scroll-aware class — keeping that
 * concern out of Phase 2.1 keeps this PR small and the nav usable on
 * every non-hero page without further work.
 */
type NavLink = {
  href: '/' | '/properties' | '/about' | '/contact';
  labelKey: 'home' | 'properties' | 'about' | 'contact';
};

const NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: '/', labelKey: 'home' },
  { href: '/properties', labelKey: 'properties' },
  { href: '/about', labelKey: 'about' },
  { href: '/contact', labelKey: 'contact' },
];

export async function Nav({ locale, className }: { locale: Locale; className?: string }) {
  const tNav = await getTranslations({ locale, namespace: 'public.nav' });
  const tBrand = await getTranslations({ locale, namespace: 'public.brand' });

  const resolvedLinks = NAV_LINKS.map((link) => ({ href: link.href, label: tNav(link.labelKey) }));

  return (
    <header
      className={cn(
        'bg-teal-forest-700 text-canvas border-brass-400/10 sticky top-0 z-30 w-full border-b',
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-edge md:h-20">
        {/* Brand mark — wordmark only for Phase 2.1; a real logo can drop
            in later by replacing this span without touching layout. */}
        <Link
          href="/"
          className="text-brass-400 hover:text-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-forest-700 text-xl font-bold uppercase tracking-[0.3em] transition-colors"
        >
          {tBrand('name')}
        </Link>

        {/* Desktop link list */}
        <nav aria-label={tNav('home')} className="hidden md:block">
          <ul className="flex items-center gap-8">
            {resolvedLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-canvas/80 hover:text-brass-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-forest-700 text-sm font-bold uppercase tracking-[0.15em] transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop lang switcher (mobile equivalent lives inside the drawer) */}
        <div className="hidden md:block">
          <LangSwitcher />
        </div>

        {/* Mobile hamburger -> drawer */}
        <MobileDrawer links={resolvedLinks} locale={locale} />
      </div>
    </header>
  );
}
