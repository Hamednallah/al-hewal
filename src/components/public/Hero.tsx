import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';

/**
 * Home hero.
 *
 * Full-bleed dark Forest Teal canvas — the architectural backdrop the
 * Stitch mockups frame the page on. Until a real architectural photo
 * lands (admin upload, Phase 3), the visual weight comes from a
 * subtle layered geometry pattern rendered in pure SVG: a grid of
 * thin brass lines + asymmetric brass blocks evoking floor-plan
 * blueprints. Pure CSS / SVG = no extra image bytes shipped to the
 * client, and no licensing concerns.
 *
 * Layout:
 *   - Eyebrow label (label-caps, brass) - small contextual tag
 *   - Display headline (Arabic-first sizing via :lang in globals.css)
 *   - Sub-headline body copy
 *   - Two CTAs side-by-side on >= sm, stacked on mobile
 *
 * Min-height calc subtracts the 80px nav height on desktop so the hero
 * lands EXACTLY in the viewport on first load. On mobile (nav 64px)
 * the calc keeps it tight as well.
 */
export async function Hero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'public.home.hero' });

  return (
    <section className="bg-teal-forest-700 text-canvas relative overflow-hidden">
      <BlueprintBackdrop />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] flex-col items-start justify-center gap-8 px-edge py-24 md:min-h-[calc(100vh-5rem)] md:py-32">
        {/* Asymmetric layout per DESIGN.md: 8-col content block in a
            12-col grid, leaving the inline-end side for the backdrop
            to breathe. Implemented with max-width since we don't run
            a 12-col grid framework. */}
        <div className="flex max-w-3xl flex-col gap-6">
          <p className="text-brass-400 text-xs uppercase tracking-[0.4em]">{t('eyebrow')}</p>
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

/**
 * Decorative blueprint-style backdrop. Pure SVG — ships as inline markup
 * so no extra HTTP request, no licensing, and the rendered weight is
 * a few hundred bytes after gzip. aria-hidden because purely decorative.
 */
function BlueprintBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1440 900"
      role="presentation"
    >
      <defs>
        <pattern id="al-hewal-grid" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#D4B982" strokeWidth="0.5" opacity="0.15" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#al-hewal-grid)" />
      {/* Architectural block accents — echo the Stitch design's "floor plan" feel */}
      <rect x="960" y="220" width="320" height="240" fill="none" stroke="#D4B982" strokeWidth="1" opacity="0.25" />
      <rect x="1040" y="320" width="200" height="180" fill="#D4B982" opacity="0.05" />
      <line x1="1040" y1="220" x2="1040" y2="500" stroke="#D4B982" strokeWidth="0.5" opacity="0.3" />
      <line x1="960" y1="320" x2="1280" y2="320" stroke="#D4B982" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}
