'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

import { LangSwitcher } from './LangSwitcher';

/**
 * Mobile slide-in nav drawer.
 *
 * Radix Dialog gives us the WAI-ARIA contract for free:
 *   - focus trap inside the panel
 *   - Esc closes
 *   - aria-modal + role=dialog announced to screen readers
 *   - returns focus to the trigger button on close
 *
 * The trigger button is a hamburger that shows only on `md:hidden`. The
 * panel slides in from the inline-end side (right in LTR, left in RTL)
 * using logical-property animation classes so it mirrors automatically.
 */
type NavLink = {
  href: '/' | '/properties' | '/about' | '/contact';
  label: string;
};

type MobileDrawerProps = {
  links: ReadonlyArray<NavLink>;
  locale: Locale;
};

export function MobileDrawer({ links, locale: _locale }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('public.common');

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={t('openMenu')}
          className="text-canvas hover:text-brass-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-forest-700 inline-flex h-10 w-10 items-center justify-center transition-colors md:hidden"
        >
          <HamburgerIcon />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-teal-forest-900/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          // Drawer has a Title but no Description — opting out per Radix
          // contract (sets the dialog's aria-describedby to nothing).
          aria-describedby={undefined}
          className={cn(
            'bg-teal-forest-700 text-canvas fixed inset-y-0 end-0 z-50 flex w-72 max-w-[80vw] flex-col gap-8 p-8 shadow-2xl',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-end',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-end',
            'focus:outline-none',
          )}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-brass-400 text-xs uppercase tracking-[0.3em]">
              {t('openMenu')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={t('closeMenu')}
                className="text-canvas hover:text-brass-400 -me-2 inline-flex h-10 w-10 items-center justify-center transition-colors"
              >
                <CloseIcon />
              </button>
            </Dialog.Close>
          </div>
          <nav>
            <ul className="flex flex-col gap-1">
              {links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Dialog.Close asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          'block border-s-2 ps-4 py-3 text-base uppercase tracking-[0.15em] transition-colors',
                          isActive
                            ? 'border-brass-400 text-brass-400'
                            : 'border-transparent text-canvas/80 hover:border-brass-400 hover:text-brass-400',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {link.label}
                      </Link>
                    </Dialog.Close>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-auto">
            <LangSwitcher />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Inline SVG icons keep the bundle small (no icon font load — see PR 2.0
// commit message; Material Symbols defers until property detail page).
function HamburgerIcon() {
  return (
    <svg
      width="20"
      height="14"
      viewBox="0 0 20 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <line x1="0" y1="1" x2="20" y2="1" />
      <line x1="0" y1="7" x2="20" y2="7" />
      <line x1="0" y1="13" x2="20" y2="13" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="13" y2="13" />
      <line x1="13" y1="1" x2="1" y2="13" />
    </svg>
  );
}
