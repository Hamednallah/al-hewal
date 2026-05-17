import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';

/**
 * Public footer.
 *
 * Server component, all content sourced from the message catalog. The
 * brand block on the left, an "Explore" link column in the middle, and
 * a Contact / WhatsApp CTA on the right. Mobile collapses to a single
 * column stack.
 *
 * The WhatsApp link uses `wa.me/<phone>` directly. Phase 2.5 introduces
 * `/api/whatsapp/track` for server-recorded clicks; this footer button
 * will swap to that URL in that PR. For now the direct link works and
 * keeps the footer functional even when the API route is not yet live.
 */
export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'public.footer' });
  const tBrand = await getTranslations({ locale, namespace: 'public.brand' });
  const whatsappPhone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? '';
  const year = new Date().getFullYear();

  return (
    <footer className="bg-teal-forest-700 text-canvas border-brass-400/10 border-t">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-edge py-16 md:grid-cols-3 md:gap-8 md:py-20">
        {/* Brand + about */}
        <div className="md:col-span-1">
          <p className="text-brass-400 mb-4 text-xs uppercase tracking-[0.3em]">{tBrand('name')}</p>
          <p className="text-canvas mb-6 max-w-sm text-2xl font-semibold leading-tight md:text-3xl">
            {t('tagline')}
          </p>
          <p className="text-canvas/70 max-w-sm text-sm leading-relaxed">{t('about')}</p>
        </div>

        {/* Explore links */}
        <nav aria-label={t('sectionExplore')} className="md:col-span-1">
          <p className="text-brass-400 mb-4 text-xs uppercase tracking-[0.3em]">
            {t('sectionExplore')}
          </p>
          <ul className="flex flex-col gap-3">
            <li>
              <Link
                href="/properties"
                className="text-canvas/80 hover:text-brass-400 text-sm uppercase tracking-[0.15em] transition-colors"
              >
                {t('linkProperties')}
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="text-canvas/80 hover:text-brass-400 text-sm uppercase tracking-[0.15em] transition-colors"
              >
                {t('linkAbout')}
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className="text-canvas/80 hover:text-brass-400 text-sm uppercase tracking-[0.15em] transition-colors"
              >
                {t('linkContact')}
              </Link>
            </li>
          </ul>
        </nav>

        {/* Contact CTA */}
        <div className="md:col-span-1">
          <p className="text-brass-400 mb-4 text-xs uppercase tracking-[0.3em]">
            {t('sectionContact')}
          </p>
          {whatsappPhone ? (
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brass-400 text-teal-forest-700 hover:bg-canvas inline-flex items-center px-6 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-colors"
            >
              {t('whatsapp')}
            </a>
          ) : null}
        </div>
      </div>
      <div className="border-brass-400/10 border-t">
        <div className="mx-auto max-w-[1440px] px-edge py-6">
          <p className="text-canvas/50 text-xs">{t('rights', { year })}</p>
        </div>
      </div>
    </footer>
  );
}
