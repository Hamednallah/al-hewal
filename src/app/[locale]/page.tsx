import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale: locale as Locale, namespace: 'public.home.hero' });
  const tBrand = await getTranslations({ locale: locale as Locale, namespace: 'public.brand' });

  return (
    <main className="bg-teal-forest-700 text-canvas flex min-h-screen flex-col items-center justify-center">
      <div className="px-edge mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <p className="text-brass-400 text-sm tracking-[0.3em] uppercase">{tBrand('name')}</p>
        <h1 className="text-4xl leading-tight font-bold text-balance md:text-6xl">
          {t('headline')}
        </h1>
        <p className="text-canvas/80 max-w-2xl text-lg leading-relaxed">{t('subheadline')}</p>
        <p className="border-brass-400/30 text-brass-400/70 border-t pt-8 text-xs tracking-widest uppercase">
          Phase 1 placeholder — design system implementation in progress
        </p>
      </div>
    </main>
  );
}
