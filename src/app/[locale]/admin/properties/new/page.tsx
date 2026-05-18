import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { PropertyForm } from '@/components/admin/PropertyForm';
import { type Locale, routing } from '@/i18n/routing';
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
  const t = await getTranslations({ locale, namespace: 'admin.properties.form' });
  return { title: t('newTitle'), robots: { index: false, follow: false } };
}

export default async function NewPropertyPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await requireAdmin();
  const typedLocale = locale as Locale;

  const [t, tCommon] = await Promise.all([
    getTranslations({ locale: typedLocale, namespace: 'admin.properties.form' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.common' }),
  ]);

  return (
    <>
      <AdminTopbar eyebrow={tCommon('section')} title={t('newTitle')} subtitle={t('newSubtitle')} />
      <div className="bg-canvas-raised border-outline-variant/30 mx-auto mt-6 mb-12 max-w-5xl border">
        <PropertyForm locale={typedLocale} mode="create" />
      </div>
    </>
  );
}
