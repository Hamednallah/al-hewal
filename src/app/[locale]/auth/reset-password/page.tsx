import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { type Locale, routing } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
 * Landing page for Supabase's recovery email.
 *
 * Supabase redirects the user here with `?code=...` after they click
 * the link in the recovery email. We exchange that code into a
 * Supabase Auth session immediately so the in-page form action can
 * call `supabase.auth.updateUser({ password })` on submit.
 *
 * If the code is missing, expired, or already consumed, the exchange
 * fails and we bounce the user back to `/auth/forgot` to request a
 * fresh email.
 */
export default async function ResetPasswordPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { code } = await searchParams;

  // Exchange the recovery code for a Supabase session if one was
  // supplied. After this, the cookie holds an `auth.users` session
  // good enough for `updateUser({ password })` to succeed.
  //
  // If the user lands here without a code AND already has a session
  // (e.g. they refreshed after a successful exchange), the form still
  // works — Supabase's existing session is reused.
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn('[auth/reset-password] code exchange failed:', error.message);
      redirect(`/${locale}/auth/forgot?error=expired`);
    }
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
