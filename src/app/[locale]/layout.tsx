import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import '@/styles/globals.css';

import { ibmPlexSans, tajawalArabic } from '@/lib/fonts';
import { getDirection, type Locale, routing } from '@/i18n/routing';

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Per-locale metadata. Title and description come from the message catalog
 * so reviewers can verify them in either language. `alternates.languages`
 * emits the `hreflang` tags that Saudi Google relies on to surface the
 * Arabic version to KSA traffic.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: 'public.brand' });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t('name'),
      template: `%s | ${t('name')}`,
    },
    description: t('tagline'),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'ar-SA': '/ar',
        en: '/en',
        'x-default': '/ar',
      },
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
        { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
      shortcut: ['/favicon.ico'],
    },
    manifest: '/manifest.webmanifest',
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#002b2b',
  // Tell every browser this is a designed light-mode (canvas + brass
  // accents) site — opts OUT of Android Chrome / Samsung Internet's
  // auto-dark inversion that was turning brass surfaces into muddy
  // brown on phones in OS dark mode.
  colorScheme: 'light',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale tree (next-intl 4 pattern).
  setRequestLocale(locale);

  const messages = await getMessages();
  const typedLocale = locale as Locale;
  const dir = getDirection(typedLocale);

  return (
    <html
      lang={typedLocale}
      dir={dir}
      className={`${ibmPlexSans.variable} ${tajawalArabic.variable}`}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider locale={typedLocale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
