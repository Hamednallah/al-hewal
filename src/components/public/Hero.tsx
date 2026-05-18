import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';

/**
 * Home hero.
 *
 * Full-bleed brand photograph (the official Al Hewal logo wall, supplied
 * by the owner). A teal-forest gradient overlay sits between the photo
 * and the text so the brand colours read consistently AND the headline
 * stays AA-contrast against the image. The gradient runs from
 * inline-start (heavy teal where the text lives) to inline-end (lighter
 * so the logo wall is still visible).
 *
 * Layout:
 *   - Eyebrow label (label-caps, brass) — small contextual tag
 *   - Display headline (Arabic-first sizing via :lang in globals.css)
 *   - Sub-headline body copy
 *   - Two CTAs side-by-side on >= sm, stacked on mobile
 *
 * Min-height calc subtracts the 64-80px nav height so the hero lands
 * EXACTLY in the viewport on first load on both mobile and desktop.
 */
export async function Hero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'public.home.hero' });
  const tBrand = await getTranslations({ locale, namespace: 'public.brand' });

  return (
    <section className="bg-teal-forest-700 text-canvas relative overflow-hidden">
      {/* Brand photograph — full-bleed background. priority because it is
          the LCP element on first paint. */}
      <Image
        src="/brand/hero.png"
        alt={tBrand('name')}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Locale-aware overlay. AR pages read RTL so the text column lives
          on the inline-end (right) side of the layout — the gradient
          mirrors via `to-l` for AR / `to-r` for EN. Both keep the photo
          peeking on the opposite side. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-teal-forest-900/95 via-teal-forest-800/85 to-teal-forest-800/40 rtl:bg-gradient-to-l"
      />

      {/* Subtle brass grid still rides on top of the photo — preserves
          the architectural feel from the original Phase 2 design while
          letting the new photo carry the brand. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1440 900"
        role="presentation"
      >
        <defs>
          <pattern id="al-hewal-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#D4B982" strokeWidth="0.5" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#al-hewal-grid)" />
      </svg>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] flex-col items-start justify-center gap-8 px-edge py-24 md:min-h-[calc(100vh-5rem)] md:py-32">
        <div className="flex max-w-3xl flex-col gap-6">
          <p className="text-brass-400 text-xs tracking-[0.4em] uppercase">{t('eyebrow')}</p>
          <h1 className="text-balance text-4xl font-bold leading-tight md:text-6xl lg:text-7xl">
            {t('headline')}
          </h1>
          <p className="text-canvas/85 max-w-xl text-lg leading-relaxed md:text-xl">
            {t('subheadline')}
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild variant="secondary" size="lg">
            <Link href="/properties">{t('ctaProjects')}</Link>
          </Button>
          {/* Hero WhatsApp CTA goes through the tracked endpoint
              (PR 2.5) so the home-page click is captured as a lead.
              Plain <a> because the locale segment must NOT prefix /api. */}
          <Button asChild variant="ghost" size="lg">
            <a
              href={`/api/whatsapp/track?locale=${locale}`}
              rel="noopener noreferrer"
              data-event="whatsapp-click"
            >
              {t('ctaContact')}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
