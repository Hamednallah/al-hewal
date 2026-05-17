import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';

/**
 * Public home — Phase 2.1 placeholder.
 *
 * Wrapped by the (public) layout's Nav + Footer. The full hero, value-prop
 * grid, featured carousel, and trust banner land in PR 2.2. For now the
 * page renders the brand wordmark + hero copy + two CTAs (one to the
 * catalog, one to contact) so the chrome around it is visible end-to-end.
 *
 * NOTE: the surrounding <main> tag now lives in the (public) layout —
 * this page renders ONLY its own content so chrome wraps it cleanly.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;

  const t = await getTranslations({ locale: typedLocale, namespace: 'public.home.hero' });
  const tBrand = await getTranslations({ locale: typedLocale, namespace: 'public.brand' });

  return (
    <section className="bg-teal-forest-700 text-canvas flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center">
      <div className="px-edge mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <p className="text-brass-400 text-sm tracking-[0.3em] uppercase">{tBrand('name')}</p>
        <h1 className="text-4xl leading-tight font-bold text-balance md:text-6xl">
          {t('headline')}
        </h1>
        <p className="text-canvas/80 max-w-2xl text-lg leading-relaxed">{t('subheadline')}</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <Button asChild variant="primary" size="lg">
            <Link href="/properties">{t('ctaProjects')}</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/contact">{t('ctaContact')}</Link>
          </Button>
        </div>
        <p className="border-brass-400/30 text-brass-400/70 border-t pt-8 text-xs tracking-widest uppercase">
          Phase 2.1 chrome live · hero + value-prop arrive in 2.2
        </p>
      </div>
    </section>
  );
}
