'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';

interface PropertyDraftBannerProps {
  propertyId: string;
  /** Public site URL the property WILL live at after publish (for the "view" hint). */
  publicHref: string;
}

/**
 * Draft-status banner shown above the edit form when a property's
 * `status === 'draft'`. Surfaces both the consequence ("the public
 * site can't see this yet") and the one-click action ("Publish now")
 * so admins don't have to dig into the listings row actions or scroll
 * to the Status dropdown.
 *
 * Hits the same `/api/properties/[id]/publish` endpoint that the
 * listings row action uses (PR 3.3b). On success, `router.refresh()`
 * re-fetches the page; the parent banner unmounts because the status
 * is no longer draft.
 */
export function PropertyDraftBanner({ propertyId, publicHref }: PropertyDraftBannerProps) {
  const t = useTranslations('admin.properties.draftBanner');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPublish() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/properties/${propertyId}/publish`, { method: 'POST' });
        if (!res.ok) {
          setError(t('failureToast'));
          return;
        }
        router.refresh();
      } catch {
        setError(t('failureToast'));
      }
    });
  }

  return (
    <div
      data-testid="property-draft-banner"
      role="status"
      className="border-brass-400 bg-brass-400/10 border-s-4 p-4 md:p-5"
    >
      <p className="text-charcoal text-sm leading-relaxed">
        <strong className="text-teal-forest-700 font-semibold">{t('label')}</strong>{' '}
        <span>{t('body', { publicHref })}</span>
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" variant="primary" size="sm" disabled={pending} onClick={onPublish}>
          {pending ? t('publishingButton') : t('publishButton')}
        </Button>
        {error ? <span className="text-xs text-[#7d1c1c]">{error}</span> : null}
      </div>
    </div>
  );
}
