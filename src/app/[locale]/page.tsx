import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale: locale as Locale, namespace: 'public.home.hero' });
  const tBrand = await getTranslations({ locale: locale as Locale, namespace: 'public.brand' });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-teal-forest-700 text-canvas">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-edge text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-brass-400">{tBrand('name')}</p>
        <h1 className="text-balance text-4xl font-bold leading-tight md:text-6xl">
          {t('headline')}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-canvas/80">{t('subheadline')}</p>
        <p className="border-t border-brass-400/30 pt-8 text-xs uppercase tracking-widest text-brass-400/70">
          Phase 1 placeholder — design system implementation in progress
        </p>
      </div>
    </main>
  );
}
