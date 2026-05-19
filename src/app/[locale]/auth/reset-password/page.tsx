import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { type Locale, routing } from '@/i18n/routing';

import ResetPasswordForm from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'admin.auth.reset' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

/**
 * Landing page for Supabase's recovery + invite emails.
 *
 * The page is form-only — the Supabase recovery code exchange runs in
 * `/auth/recovery` (Route Handler), NOT here. Server Components in
 * Next 15 cannot write cookies, so doing the exchange in this render
 * silently dropped the session cookies and the form action saw no
 * user on submit ("Your reset session has expired" even when the
 * code was still valid). See `src/app/auth/recovery/route.ts` for
 * the full root-cause writeup.
 *
 * Back-compat: in-flight emails configured before the new flow point
 * at `/<locale>/auth/reset-password?code=...`. We detect that and
 * redirect to `/auth/recovery?code=...&locale=...` so old links keep
 * working through the exchange transparently.
 */
export default async function ResetPasswordPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { code } = await searchParams;

  // Back-compat: any email link still in the wild that points
  // here with `?code=` needs the Route-Handler exchange path.
  if (code) {
    const recovery = new URLSearchParams({ code, locale });
    redirect(`/auth/recovery?${recovery.toString()}`);
  }

  return (
    <main className="bg-teal-forest text-canvas min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link
          href={`/${locale}`}
          className="text-canvas/70 hover:text-brass mx-auto mb-8 block text-center text-sm"
        >
          ← Al Hewal
        </Link>
        <div className="border-canvas/15 bg-teal-forest-800/50 border p-8 shadow-2xl">
          <ResetPasswordForm locale={locale as Locale} />
        </div>
      </div>
    </main>
  );
}
