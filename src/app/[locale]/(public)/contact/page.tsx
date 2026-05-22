import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContactForm } from '@/components/public/ContactForm';
import { type Locale } from '@/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const WHATSAPP_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? '';

/**
 * Contact page — direct channels strip + Zod-validated form that
 * POSTs to `/api/leads` (built in PR 2.5).
 *
 * The "direct channels" block routes through `/api/whatsapp/track`
 * so the click lands in `leads` + `whatsapp_clicks` the same way a
 * property-card WhatsApp tap does.
 *
 * `force-dynamic` because the form is a client component and the page
 * is intentionally a low-traffic conversion surface — ISR adds nothing.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tBrand = await getTranslations({ locale, namespace: 'public.brand' });
  const t = await getTranslations({ locale, namespace: 'public.contact' });
  const canonical = `${SITE_URL}/${locale}/contact`;
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: {
      canonical,
      languages: {
        'ar-SA': `${SITE_URL}/ar/contact`,
        en: `${SITE_URL}/en/contact`,
        'x-default': `${SITE_URL}/ar/contact`,
      },
    },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: tBrand('name'),
      title: t('pageTitle'),
      description: t('pageDescription'),
      locale,
    },
  };
}

type Params = { locale: string };

export default async function ContactPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;
  const t = await getTranslations({ locale, namespace: 'public.contact' });

  const waHref = `/api/whatsapp/track?locale=${locale}`;
  const telHref = WHATSAPP_PHONE ? `tel:+${WHATSAPP_PHONE}` : null;

  return (
    <article>
      <header className="bg-teal-forest-700 text-canvas">
        <div className="px-edge mx-auto max-w-[1440px] py-16 md:py-24">
          <p className="text-brass-400 text-sm tracking-[0.4em] uppercase">{t('pageEyebrow')}</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-bold text-balance md:text-5xl">
            {t('pageTitle')}
          </h1>
          <p className="text-canvas/85 mt-6 max-w-2xl text-base leading-relaxed md:text-lg md:leading-loose">
            {t('pageDescription')}
          </p>
        </div>
      </header>

      <section className="bg-canvas">
        <div className="px-edge mx-auto grid max-w-[1440px] grid-cols-1 gap-12 py-16 md:grid-cols-12 md:gap-10 md:py-20">
          {/* Direct channels — sticky on desktop. */}
          <aside className="md:col-span-5 lg:col-span-4">
            <div className="bg-teal-forest-700 text-canvas border-brass-400 border-t-4 p-6 shadow-2xl md:sticky md:top-28 md:p-8">
              <h2 className="text-brass-400 mb-3 text-sm tracking-[0.3em] uppercase">
                {t('directTitle')}
              </h2>
              <p className="text-canvas/80 mb-6 text-sm leading-relaxed md:text-base">
                {t('directBody')}
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href={waHref}
                  rel="noopener noreferrer"
                  data-event="whatsapp-click"
                  className="bg-brass-400 text-teal-forest-700 hover:bg-canvas focus-visible:ring-canvas focus-visible:ring-offset-teal-forest-700 inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold tracking-[0.25em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {t('whatsappCta')}
                </a>
                {telHref ? (
                  <a
                    href={telHref}
                    className="border-brass-400 text-brass-400 hover:bg-brass-400/10 focus-visible:ring-brass-400 focus-visible:ring-offset-teal-forest-700 inline-flex items-center justify-center gap-2 border-2 px-6 py-3.5 text-sm font-bold tracking-[0.25em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {t('callCta')}
                  </a>
                ) : null}
              </div>
            </div>
          </aside>

          {/* Form. */}
          <div className="md:col-span-7 lg:col-span-8">
            <ContactForm locale={typedLocale} />
          </div>
        </div>
      </section>
    </article>
  );
}
