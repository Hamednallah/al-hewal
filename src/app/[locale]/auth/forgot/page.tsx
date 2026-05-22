import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { type Locale, routing } from '@/i18n/routing';

import ForgotForm from './ForgotForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'admin.auth.forgot' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default async function ForgotPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="bg-teal-forest text-canvas min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link
          href={`/${locale}`}
          className="text-canvas/70 hover:text-brass mx-auto mb-8 block text-center text-sm"
        >
          ← Al Haual
        </Link>
        <div className="border-canvas/15 bg-teal-forest-800/50 border p-8 shadow-2xl">
          <ForgotForm locale={locale as Locale} />
        </div>
      </div>
    </main>
  );
}
