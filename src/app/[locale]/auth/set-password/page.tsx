import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import PasswordForm from '@/components/auth/PasswordForm';
import { type Locale, routing } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'admin.auth.setPassword' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

/**
 * Invite acceptance — "Welcome to Al Hewal, set your password" page.
 *
 * Separate from `/<locale>/auth/reset-password` so a newly-invited
 * admin sees welcoming first-time-login copy instead of recovery-tone
 * copy ("your password reset session has expired" is the wrong
 * narrative when the user has never had a password to begin with).
 *
 * Both pages render the SAME `PasswordForm` component — they share
 * the underlying Supabase plumbing (the `/auth/recovery` route handler
 * already exchanged the PKCE code for a session) and the same server
 * action (`setNewPassword`). The split is purely UX copy.
 *
 * Back-compat: if a user lands here with `?code=` (an invite email
 * generated before the new redirectTo deployed), we redirect into
 * `/auth/recovery` so the exchange still happens.
 */
export default async function SetPasswordPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { code } = await searchParams;
  if (code) {
    const recovery = new URLSearchParams({ code, locale, type: 'invite' });
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
          <PasswordForm locale={locale as Locale} namespace="admin.auth.setPassword" />
        </div>
      </div>
    </main>
  );
}
