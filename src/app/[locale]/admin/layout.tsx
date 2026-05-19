import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AdminMobileMenu } from '@/components/admin/AdminMobileMenu';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminSidebarContent } from '@/components/admin/AdminSidebarContent';
import { routing, type Locale } from '@/i18n/routing';
import { currentAdmin } from '@/lib/auth/admins';

export const dynamic = 'force-dynamic';

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Admin shell layout — wraps every `/<locale>/admin/*` page with the
 * persistent sidebar + content frame.
 *
 * Auth: middleware already gates the path, but we re-check
 * `currentAdmin()` here too. If middleware passed but the cookie has
 * been wiped between the request hitting the edge and reaching this
 * RSC, this layer redirects cleanly instead of rendering a half-shell.
 *
 * Mobile vs desktop:
 *   - `<md`: `AdminSidebar` is hidden (`hidden md:flex`); a sticky
 *     top bar shows the brand title + a hamburger button that opens
 *     `AdminMobileMenu` (Radix Dialog mirroring the public
 *     `MobileDrawer`).
 *   - `≥md`: the sidebar is always visible, sticky to the viewport.
 */
export default async function AdminLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    redirect(`/${routing.defaultLocale}/auth/login`);
  }
  setRequestLocale(locale);

  const admin = await currentAdmin();
  if (!admin) {
    redirect(`/${locale}/auth/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  }

  const typedLocale = locale as Locale;
  const [tShell, tCommon] = await Promise.all([
    getTranslations({ locale: typedLocale, namespace: 'admin.shell' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.common' }),
  ]);

  return (
    <div className="bg-background text-on-surface flex min-h-screen">
      <AdminSidebar locale={typedLocale} admin={admin} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar: hamburger + brand title. */}
        <div
          data-testid="admin-mobile-topbar"
          className="bg-teal-forest-700 text-canvas sticky top-0 z-30 flex items-center gap-3 px-4 py-3 md:hidden"
        >
          <AdminMobileMenu
            openLabel={tCommon('openMenu')}
            closeLabel={tCommon('closeMenu')}
            title={tShell('title')}
          >
            <AdminSidebarContent locale={typedLocale} admin={admin} />
          </AdminMobileMenu>
          <span className="text-base font-semibold">{tShell('title')}</span>
        </div>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
