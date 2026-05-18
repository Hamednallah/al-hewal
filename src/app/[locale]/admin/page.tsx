import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admins';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return { robots: { index: false, follow: false } };
  }
  const t = await getTranslations({ locale, namespace: 'admin.pages.dashboard' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default async function AdminDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // requireAdmin throws if the layout slipped through somehow — keeps the
  // RSC self-contained and surfaces an early failure rather than rendering
  // garbage from a missing session.
  const admin = await requireAdmin();
  const t = await getTranslations({ locale, namespace: 'admin.pages.dashboard' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  return (
    <>
      <AdminTopbar eyebrow={tCommon('overview')} title={t('title')} subtitle={t('subtitle')} />
      <section className="bg-canvas-raised border-outline-variant/30 mx-auto mt-8 grid w-full max-w-4xl gap-6 border p-8 md:grid-cols-3">
        <SummaryCard label={t('welcomeLabel')} value={admin.email} />
        <SummaryCard label={t('tierLabel')} value={admin.tier.replace('_', ' ')} />
        <SummaryCard label={t('statusLabel')} value={admin.status} />
      </section>
      <p className="text-charcoal-muted mx-auto mt-6 max-w-4xl px-2 text-sm">{t('body')}</p>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-outline-variant/40 flex flex-col gap-2 border p-4">
      <p className="text-brass-600 text-xs tracking-[0.2em] uppercase">{label}</p>
      <p className="text-teal-forest-700 text-base font-semibold break-words">{value}</p>
    </div>
  );
}
