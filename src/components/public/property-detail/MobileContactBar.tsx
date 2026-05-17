import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/routing';

/**
 * Fixed mobile conversion bar at the bottom of the viewport.
 *
 * The WhatsApp CTA routes through `/api/whatsapp/track?p=<slug>` (PR 2.5)
 * so every click is recorded in `leads` + `whatsapp_clicks` before the
 * server 302s the visitor to wa.me. Same rationale as ContactCard.
 *
 * The main content gets `pb-24` on mobile to compensate so the bar
 * never hides the last paragraph (CLAUDE.md a11y rule and the design
 * note in SESSION_HANDOFF.md).
 *
 * Hidden on `md:` and up — the desktop sticky `ContactCard` covers
 * that breakpoint.
 */
type MobileContactBarProps = {
  title: string;
  slug: string;
  whatsappPhone: string;
  locale: Locale;
};

export async function MobileContactBar({
  title,
  slug,
  whatsappPhone,
  locale,
}: MobileContactBarProps) {
  const t = await getTranslations({ locale, namespace: 'public.propertyDetail.contact' });
  const waHref = `/api/whatsapp/track?p=${encodeURIComponent(slug)}&locale=${locale}`;
  const telHref = `tel:+${whatsappPhone}`;

  return (
    <div
      role="region"
      aria-label={t('title')}
      className="bg-teal-forest-700 border-brass-400/30 fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t p-4 shadow-[0_-10px_40px_rgba(0,43,43,0.3)] md:hidden"
    >
      <a
        href={telHref}
        aria-label={t('callAria', { title })}
        className="border-brass-400 text-brass-400 hover:bg-brass-400/10 focus-visible:ring-brass-400 focus-visible:ring-offset-teal-forest-700 inline-flex flex-1 items-center justify-center gap-2 border px-4 py-3 text-xs font-bold tracking-[0.2em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <CallIcon />
        {t('call')}
      </a>
      <a
        href={waHref}
        aria-label={t('whatsappAria', { title })}
        rel="noopener noreferrer"
        data-event="whatsapp-click"
        className="bg-brass-400 text-teal-forest-700 hover:bg-canvas focus-visible:ring-canvas focus-visible:ring-offset-teal-forest-700 inline-flex flex-[2] items-center justify-center gap-2 px-4 py-3 text-xs font-bold tracking-[0.2em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ChatIcon />
        {t('whatsapp')}
      </a>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2 2 H14 V11 H6 L2 14 V2 Z" />
    </svg>
  );
}

function CallIcon() {
  return (
    <svg
      width="14"
      height="14"
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
