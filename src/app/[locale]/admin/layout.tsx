import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AdminSidebar } from '@/components/admin/AdminSidebar';
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
 * Auth: middleware already gates the path, but we re-check `currentAdmin()`
 * here too. If middleware passed but the cookie has somehow been wiped
 * between the request hitting the edge and reaching this RSC, this layer
 * redirects cleanly instead of rendering a half-shell with no admin data.
 *
 * Desktop-only sidebar in this first cut — admin users work at desks.
 * Mobile drawer is a follow-up if the owner wants it; the public site's
 * MobileDrawer pattern (Radix Dialog) is the template.
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

  return (
    <div className="bg-background text-on-surface flex min-h-screen">
      <AdminSidebar locale={locale as Locale} admin={admin} />
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
