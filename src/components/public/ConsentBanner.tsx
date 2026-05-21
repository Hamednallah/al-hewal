'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/**
 * KSA PDPL consent banner. Renders sticky-bottom on every public
 * page until the visitor clicks "Accept". The Accept action POSTs
 * to `/api/consent`, which sets the `alh_consent=v1` cookie. The
 * banner is mounted unconditionally by the public layout when the
 * cookie is absent — see `PublicLayout` for the server-side
 * conditional check.
 *
 * Self-dismiss: on a successful POST the banner hides locally
 * (state flips). A reload would render the layout without the
 * banner thanks to the cookie now being present.
 *
 * The banner intentionally does NOT block any tracking — the
 * cookies it acknowledges (rate-limit IP hash, visitor hash,
 * lead capture) are essential to the user's voluntary actions
 * (WhatsApp click, contact form submit). The banner is
 * informative + courteous, not gating.
 */
export function ConsentBanner() {
  const t = useTranslations('public.consent');
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (dismissed) return null;

  function onAccept() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/consent', { method: 'POST', credentials: 'same-origin' });
        if (res.ok) {
          setDismissed(true);
        }
        // On non-2xx we leave the banner up so the user can retry.
      } catch {
        // Network blip; leave banner up.
      }
    });
  }

  return (
    <div
      role="region"
      aria-label={t('regionLabel')}
      data-testid="consent-banner"
      className="bg-teal-forest-700 text-canvas fixed inset-x-0 bottom-0 z-40 border-t border-brass-400/30 px-4 py-4 shadow-[0_-2px_10px_rgba(0,0,0,0.15)] md:px-8 md:py-5"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <p className="text-sm leading-relaxed">
          {t('body')}{' '}
          <Link
            href="/privacy"
            className="text-brass-300 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {t('privacyLink')}
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={pending}
            onClick={onAccept}
            data-testid="consent-accept"
          >
            {pending ? t('accepting') : t('accept')}
          </Button>
        </div>
      </div>
    </div>
  );
}
