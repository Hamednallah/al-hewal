import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admins';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'admin.pages.properties' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AdminPropertiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations({ locale, namespace: 'admin.pages.properties' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  return (
    <>
      <AdminTopbar eyebrow={tCommon('section')} title={t('title')} subtitle={t('subtitle')} />
      <AdminPlaceholder eyebrow={tCommon('comingSoon')} body={t('placeholder')} prTag="PR 3.3" />
    </>
  );
}
