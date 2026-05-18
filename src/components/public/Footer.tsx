import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';

/**
 * Public footer.
 *
 * Server component, all content sourced from the message catalog.
 *
 * Layout (per the Phase 2 wrap UX request): every column is
 * **centered** rather than aligned to inline-start/inline-end, so the
 * footer reads the same way in AR (RTL) and EN (LTR). Brand + tagline
 * sit above three centered columns (Explore links, Contact CTA,
 * Company name + copyright). This keeps the footer visually balanced
 * regardless of locale, which mattered enough to the owner that they
 * called it out explicitly.
 *
 * The WhatsApp CTA routes through `/api/whatsapp/track` (PR 2.5) so
 * footer clicks land in the leads + whatsapp_clicks tables for the
 * analytics dashboard. Plain `<a>` (not next-intl `<Link>`) because
 * the locale segment must NOT prefix `/api`.
 */
export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'public.footer' });
  const tBrand = await getTranslations({ locale, namespace: 'public.brand' });
  const year = new Date().getFullYear();

  return (
    <footer className="bg-teal-forest-700 text-canvas border-brass-400/10 border-t">
      {/* Brand block — full-width, centered. */}
      <div className="border-brass-400/10 border-b">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-4 px-edge py-12 text-center md:py-16">
          <p className="text-brass-400 text-xs tracking-[0.4em] uppercase">{tBrand('name')}</p>
          <p className="text-canvas max-w-2xl text-2xl font-semibold leading-tight md:text-3xl">
            {t('tagline')}
          </p>
          <p className="text-canvas/70 max-w-2xl text-sm leading-relaxed md:text-base">
            {t('about')}
          </p>
        </div>
      </div>

      {/* Three centered columns. On mobile they stack with the same
          centered axis — no inline-start/end bias. */}
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-edge py-14 text-center md:grid-cols-3 md:gap-8 md:py-16">
        {/* Explore */}
        <nav aria-label={t('sectionExplore')} className="flex flex-col items-center gap-4">
          <p className="text-brass-400 text-xs tracking-[0.3em] uppercase">
            {t('sectionExplore')}
          </p>
          <ul className="flex flex-col items-center gap-3">
            <li>
              <Link
                href="/properties"
                className="text-canvas/80 hover:text-brass-400 text-sm font-semibold tracking-[0.15em] uppercase transition-colors"
              >
                {t('linkProperties')}
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="text-canvas/80 hover:text-brass-400 text-sm font-semibold tracking-[0.15em] uppercase transition-colors"
              >
                {t('linkAbout')}
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className="text-canvas/80 hover:text-brass-400 text-sm font-semibold tracking-[0.15em] uppercase transition-colors"
              >
                {t('linkContact')}
              </Link>
            </li>
          </ul>
        </nav>

        {/* Direct contact CTA */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-brass-400 text-xs tracking-[0.3em] uppercase">
            {t('sectionContact')}
          </p>
          <a
            href={`/api/whatsapp/track?locale=${locale}`}
            rel="noopener noreferrer"
            data-event="whatsapp-click"
            className="bg-brass-400 text-teal-forest-700 hover:bg-canvas inline-flex items-center justify-center px-6 py-3 text-sm font-bold tracking-[0.1em] uppercase transition-colors"
          >
            {t('whatsapp')}
          </a>
        </div>

        {/* Company column — explicit copy slot the previous footer
            lacked. Mirrors the "Explore" column visually so the grid
            stays balanced. */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-brass-400 text-xs tracking-[0.3em] uppercase">
            {t('sectionCompany')}
          </p>
          <p className="text-canvas/80 max-w-xs text-sm leading-relaxed">{tBrand('name')}</p>
        </div>
      </div>

      {/* Bottom legal line — centered too. */}
      <div className="border-brass-400/10 border-t">
        <div className="mx-auto max-w-[1440px] px-edge py-6 text-center">
          <p className="text-canvas/50 text-xs">{t('rights', { year })}</p>
        </div>
      </div>
    </footer>
  );
}
