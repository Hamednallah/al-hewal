import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Footer } from '@/components/public/Footer';
import { Nav } from '@/components/public/Nav';
import { SkipToContent } from '@/components/public/SkipToContent';
import { type Locale } from '@/i18n/routing';

/**
 * Shared chrome for every public page.
 *
 * Order matters for keyboard tab flow:
 *   1. SkipToContent  (revealed on focus, jumps tab order past the nav)
 *   2. Nav
 *   3. <main id="main-content">  (skip-link target)
 *   4. Footer
 *
 * The `(public)` route group keeps URLs flat (`/ar/properties` not
 * `/ar/(public)/properties`) while letting the future `(admin)` group
 * own its own different layout without interference.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;

  return (
    <>
      <SkipToContent locale={typedLocale} />
      <Nav locale={typedLocale} />
      <main id="main-content" className="bg-canvas text-charcoal min-h-screen">
        {children}
      </main>
      <Footer locale={typedLocale} />
    </>
  );
}
