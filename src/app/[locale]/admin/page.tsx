import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { routing } from '@/i18n/routing';
import { currentAdmin } from '@/lib/auth/admins';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return { robots: { index: false, follow: false } };
  }
  const t = await getTranslations({ locale, namespace: 'admin.nav' });
  return {
    title: t('dashboard'),
    robots: { index: false, follow: false },
  };
}

/**
 * Phase 3 PR 3.1 — placeholder admin landing. Belt-and-suspenders auth:
 * middleware already guards `/<locale>/admin/*`, but this RSC re-checks
 * `currentAdmin()` because relying solely on middleware in App Router has
 * been flaky enough across Next versions that the defence-in-depth is
 * cheaper than the postmortem.
 *
 * Real admin shell + dashboard lands in PR 3.2. This file is deliberately
 * minimal so the auth → shell hand-off is clean.
 */
export default async function AdminDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    redirect(`/${routing.defaultLocale}/auth/login`);
  }
  setRequestLocale(locale);

  const admin = await currentAdmin();
  if (!admin) {
    redirect(`/${locale}/auth/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  }

  const t = await getTranslations({ locale, namespace: 'admin' });

  return (
    <main className="bg-teal-forest text-canvas min-h-screen">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-16">
        <header className="space-y-1">
          <p className="text-brass text-sm">{t('nav.dashboard')}</p>
          <h1 className="text-2xl font-medium">
            {locale === 'ar' ? `أهلاً، ${admin.email}` : `Welcome, ${admin.email}`}
          </h1>
          <p className="text-canvas/70 text-sm">
            tier: <span className="text-brass">{admin.tier}</span>
          </p>
        </header>

        <p className="text-canvas/80 text-sm leading-relaxed">
          {locale === 'ar'
            ? 'تم تسجيل الدخول بنجاح. لوحة التحكم الكاملة قيد التطوير في الإصدار القادم (PR 3.2).'
            : 'Sign-in successful. The full admin shell lands next in PR 3.2.'}
        </p>

        <Link
          href={`/auth/sign-out?next=/${locale}`}
          prefetch={false}
          className="border-canvas/30 text-canvas hover:bg-canvas/10 inline-block border px-4 py-2"
        >
          {t('common.signOut')}
        </Link>
      </div>
    </main>
  );
}
