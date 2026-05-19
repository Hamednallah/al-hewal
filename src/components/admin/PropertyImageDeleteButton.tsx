'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { cn } from '@/lib/utils';

interface PropertyImageDeleteButtonProps {
  propertyId: string;
  imageId: string;
}

/**
 * Per-image delete button. Confirms via native `window.confirm`, then
 * DELETEs `/api/properties/[propertyId]/images/[imageId]` and triggers
 * `router.refresh()` so the parent server-rendered grid re-fetches.
 *
 * Failures surface inline (role="status"); no toast system in the
 * admin shell yet.
 */
export function PropertyImageDeleteButton({ propertyId, imageId }: PropertyImageDeleteButtonProps) {
  const t = useTranslations('admin.properties.images');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (typeof window !== 'undefined' && !window.confirm(t('deleteConfirm'))) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/properties/${propertyId}/images/${imageId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          setError(t('uploadError', { filename: '' }));
          return;
        }
        router.refresh();
      } catch {
        setError(t('uploadError', { filename: '' }));
      }
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={t('deleteButton')}
        className={cn(
          'border border-[#b00020]/40 px-2.5 py-1 text-[0.7rem] font-medium tracking-wide text-[#7d1c1c] transition-colors hover:bg-[#fceaea] disabled:opacity-50',
        )}
      >
        {pending ? t('deleting') : t('deleteButton')}
      </button>
      {error ? (
        <span role="status" className="text-[0.65rem] leading-tight text-[#7d1c1c]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
