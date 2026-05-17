import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Sticky desktop contact card. Renders the brass-bordered teal block
 * from the Stitch mockup with WhatsApp + Call CTAs.
 *
 * PR 2.4 wires the CTAs directly to `wa.me` and `tel:` — the
 * tracked endpoint at `/api/whatsapp/track` lands in PR 2.5 and will
 * become the WhatsApp href. Phone number is read from
 * `NEXT_PUBLIC_WHATSAPP_PHONE` (validated as E.164 digits in env.ts).
 *
 * The pre-filled WhatsApp message includes the property URL so the
 * receiving agent knows which listing the prospect is asking about.
 *
 * On mobile this card is hidden (`md:block` only) — `MobileContactBar`
 * takes over.
 */
type ContactCardProps = {
  title: string;
  url: string;
  whatsappPhone: string;
  locale: Locale;
  className?: string;
};

export async function ContactCard({
  title,
  url,
  whatsappPhone,
  locale,
  className,
}: ContactCardProps) {
  const t = await getTranslations({ locale, namespace: 'public.propertyDetail.contact' });
  const message = t('messageTemplate', { title, url });
  const waHref = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
  const telHref = `tel:+${whatsappPhone}`;

  return (
    <aside
      className={cn(
        'bg-teal-forest-700 text-canvas border-brass-400 hidden border-t-4 p-8 shadow-2xl md:block',
        className,
      )}
    >
      <h3 className="text-brass-400 mb-4 text-xs tracking-[0.3em] uppercase">{t('title')}</h3>
      <p className="text-canvas/80 mb-8 text-sm leading-relaxed md:text-base">
        {t('body', { title })}
      </p>
      <div className="flex flex-col gap-3">
        <a
          href={waHref}
          aria-label={t('whatsappAria', { title })}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brass-400 text-teal-forest-700 hover:bg-canvas focus-visible:ring-canvas focus-visible:ring-offset-teal-forest-700 inline-flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-bold tracking-[0.25em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ChatIcon />
          {t('whatsapp')}
        </a>
        <a
          href={telHref}
          aria-label={t('callAria', { title })}
          className="border-brass-400 text-brass-400 hover:bg-brass-400/10 focus-visible:ring-brass-400 focus-visible:ring-offset-teal-forest-700 inline-flex items-center justify-center gap-2 border-2 px-6 py-3.5 text-xs font-bold tracking-[0.25em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <CallIcon />
          {t('call')}
        </a>
      </div>
    </aside>
  );
}

function ChatIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0"
      aria-hidden="true"
    >
      <path d="M2 2 H14 V11 H6 L2 14 V2 Z" />
    </svg>
  );
}

function CallIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d="M2 3 L5 2 L7 5 L5 7 a8 8 0 0 0 4 4 L11 9 L14 11 L13 14 a12 12 0 0 1 -11 -11 Z" />
    </svg>
  );
}
