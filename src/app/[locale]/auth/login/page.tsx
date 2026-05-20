import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { hasLocale } from 'next-intl';

import { routing } from '@/i18n/routing';

import LoginForm from './LoginForm';
import type { LoginErrorKey } from './actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'admin.auth.login' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

const ALLOWED_ERRORS = new Set<string>([
  'invalidInput',
  'wrongCredentials',
  'supabase',
  'notAdmin',
  'callbackInvalid',
  'callbackExpired',
  // Invite acceptance landed on /auth/recovery with an expired /
  // already-consumed Supabase token. We send invitees here (rather
  // than to /auth/forgot) because they have no password to recover —
  // they need a fresh invitation, not a reset link.
  'inviteExpired',
]);

export default async function LoginPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { next, error } = await searchParams;
  const sanitizedNext = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined;
  const initialError =
    error && ALLOWED_ERRORS.has(error)
      ? (error as LoginErrorKey | 'callbackInvalid' | 'callbackExpired' | 'inviteExpired')
      : undefined;

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
          <LoginForm next={sanitizedNext} initialError={initialError} />
        </div>
      </div>
    </main>
  );
}
