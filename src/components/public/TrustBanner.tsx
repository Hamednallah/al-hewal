import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';

/**
 * Trust banner — full-bleed dark Forest Teal band promoting the
 * 1-year warranty. Sits between the featured projects section and the
 * footer. Acts as a visual "punctuation" between content rhythms per
 * DESIGN.md ("Tonal Layering").
 *
 * Layout: two-column on >= md (headline+body on inline-start,
 * brass CTA on inline-end), stacked on mobile.
 *
 * The verified-icon visual is a small inline SVG (no font / image
 * dependency), echoing the Stitch mockup's badge styling.
 */
export async function TrustBanner({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'public.home.trustBanner' });

  return (
    <section className="bg-teal-forest-700 text-canvas border-brass-400/15 border-y">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-edge py-16 md:flex-row md:items-center md:justify-between md:gap-12 md:py-20">
        <div className="flex max-w-2xl items-start gap-6">
          <span
            aria-hidden="true"
            className="border-brass-400 text-brass-400 flex h-14 w-14 flex-none items-center justify-center border md:h-16 md:w-16"
          >
            <VerifiedMark />
          </span>
          <div className="flex flex-col gap-3">
            <h2 className="text-balance text-2xl font-bold leading-tight md:text-3xl">
              {t('headline')}
            </h2>
            <p className="text-canvas/85 max-w-xl text-base leading-relaxed">{t('body')}</p>
          </div>
        </div>
        <div className="md:flex-none">
          <Button asChild variant="secondary" size="lg">
            <Link href="/contact">{t('cta')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function VerifiedMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <polyline points="5 12 10 17 19 7" />
    </svg>
  );
}
