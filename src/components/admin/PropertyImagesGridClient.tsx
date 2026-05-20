'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition, type DragEvent } from 'react';

import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/routing';
import type { AdminPropertyImageRow } from '@/lib/data/admin-properties';

import { PropertyImageDeleteButton } from './PropertyImageDeleteButton';

/**
 * Drag-reorder + set-as-hero gallery (PR 3.5c).
 *
 * The previous server-rendered grid (PR 3.5b) had no interaction; this
 * client component takes over the rendering so each tile can:
 *
 *   - Be dragged (HTML5 native drag-and-drop) onto another tile to swap
 *     positions. Drop fires a PATCH /api/properties/[id]/images/reorder
 *     with the entire new order array. The local state updates
 *     optimistically; on a server failure the original order is
 *     restored and an inline error renders.
 *   - Be moved earlier / later via two arrow buttons (keyboard +
 *     screen-reader fallback for the drag affordance).
 *   - Be promoted to hero via a "Set as hero" button (POST to the
 *     companion `/hero` route). The chosen tile shows a brass "Hero"
 *     ribbon; the public detail page + catalog card both already pick
 *     `is_hero === true` first.
 *
 * No new dep — uses the platform's HTML5 drag API directly so the
 * admin-bundle JS budget stays put.
 */

interface PropertyImagesGridClientProps {
  locale: Locale;
  propertyId: string;
  images: AdminPropertyImageRow[];
}

type ReorderError = 'reorder' | 'hero' | null;

export function PropertyImagesGridClient({
  locale,
  propertyId,
  images: initialImages,
}: PropertyImagesGridClientProps) {
  const t = useTranslations('admin.properties.images');
  const router = useRouter();
  const [images, setImages] = useState<AdminPropertyImageRow[]>(initialImages);
  const [pending, startTransition] = useTransition();
  const [heroPending, setHeroPending] = useState<string | null>(null);
  const [error, setError] = useState<ReorderError>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Sync local state when the parent server component re-renders with a
  // fresh images list. Triggered by `router.refresh()` after the
  // uploader posts a new file or the delete button removes a row — the
  // server re-fetches `listPropertyImages`, passes the new array to us,
  // and this effect reflects it in the grid without a hard navigation.
  //
  // The reference-equality dep means a same-data re-render is a no-op,
  // so any in-flight optimistic reorder/hero update we're mid-applying
  // doesn't get clobbered between the optimistic setImages and the
  // `router.refresh()` that runs once the server write returns 200.
  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  const apply = useCallback(
    (next: AdminPropertyImageRow[]) => {
      const snapshot = images;
      setImages(next);
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch(`/api/properties/${propertyId}/images/reorder`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds: next.map((i) => i.id) }),
          });
          if (!res.ok) {
            setImages(snapshot);
            setError('reorder');
            return;
          }
          router.refresh();
        } catch {
          setImages(snapshot);
          setError('reorder');
        }
      });
    },
    [images, propertyId, router],
  );

  const move = useCallback(
    (id: string, delta: -1 | 1) => {
      const idx = images.findIndex((i) => i.id === id);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= images.length) return;
      const next = images.slice();
      const moved = next.splice(idx, 1)[0];
      if (!moved) return;
      next.splice(target, 0, moved);
      apply(next);
    },
    [images, apply],
  );

  const swap = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const fromIdx = images.findIndex((i) => i.id === fromId);
      const toIdx = images.findIndex((i) => i.id === toId);
      if (fromIdx < 0 || toIdx < 0) return;
      const next = images.slice();
      const moved = next.splice(fromIdx, 1)[0];
      if (!moved) return;
      next.splice(toIdx, 0, moved);
      apply(next);
    },
    [images, apply],
  );

  const onDragStart = (id: string) => (e: DragEvent<HTMLLIElement>) => {
    setDraggingId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (id: string) => (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (id: string) => (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!sourceId) return;
    swap(sourceId, id);
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const setHero = (id: string) => {
    if (heroPending || pending) return;
    const snapshot = images;
    setHeroPending(id);
    setError(null);
    setImages((current) => current.map((img) => ({ ...img, is_hero: img.id === id })));
    startTransition(async () => {
      try {
        const res = await fetch(`/api/properties/${propertyId}/images/${id}/hero`, {
          method: 'PATCH',
        });
        if (!res.ok) {
          setImages(snapshot);
          setError('hero');
          return;
        }
        router.refresh();
      } catch {
        setImages(snapshot);
        setError('hero');
      } finally {
        setHeroPending(null);
      }
    });
  };

  const orderedImages = useMemo(() => images, [images]);

  if (orderedImages.length === 0) {
    return (
      <p
        data-testid="property-images-empty"
        className="text-charcoal-muted bg-canvas-sunken/30 border-outline-variant/30 border p-4 text-sm leading-relaxed"
      >
        {t('noImages')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-charcoal-muted text-xs">
          {t('imagesCount', { count: orderedImages.length })}
        </p>
        {pending ? (
          <p role="status" className="text-charcoal-muted text-xs">
            {t('saving')}
          </p>
        ) : null}
      </div>
      <p className="text-charcoal-muted text-xs leading-relaxed">{t('reorderHint')}</p>
      {error === 'reorder' ? (
        <p role="alert" className="text-xs text-[#7d1c1c]">
          {t('reorderFailed')}
        </p>
      ) : null}
      {error === 'hero' ? (
        <p role="alert" className="text-xs text-[#7d1c1c]">
          {t('setHeroFailed')}
        </p>
      ) : null}
      <ul
        data-testid="property-images-grid"
        className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
      >
        {orderedImages.map((img, idx) => {
          const alt = locale === 'ar' ? img.alt_ar : img.alt_en;
          const isFirst = idx === 0;
          const isLast = idx === orderedImages.length - 1;
          const isDragging = draggingId === img.id;
          const isDragTarget = dragOverId === img.id && draggingId !== img.id;
          const isHero = img.is_hero;
          return (
            <li
              key={img.id}
              data-testid={`property-image-tile-${img.id}`}
              draggable
              onDragStart={onDragStart(img.id)}
              onDragOver={onDragOver(img.id)}
              onDrop={onDrop(img.id)}
              onDragEnd={onDragEnd}
              className={cn(
                'bg-canvas border-outline-variant/30 relative flex cursor-move flex-col gap-2 border p-2 transition-all',
                isDragging && 'opacity-40',
                isDragTarget && 'border-brass ring-brass/40 ring-2',
              )}
            >
              {isHero ? (
                <span
                  data-testid="hero-badge"
                  aria-label={t('heroBadgeAria')}
                  className="bg-brass text-teal-forest absolute start-2 top-2 z-10 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase"
                >
                  {t('heroBadge')}
                </span>
              ) : null}
              <picture>
                {img.webp_url ? <source srcSet={img.webp_url} type="image/webp" /> : null}
                <source srcSet={img.blob_url} type="image/avif" />
                <img
                  src={img.blob_url}
                  alt={alt || t('thumbnailAlt', { position: idx + 1 })}
                  width={img.width}
                  height={img.height}
                  loading="lazy"
                  draggable={false}
                  className="aspect-[4/3] h-auto w-full object-cover"
                />
              </picture>
              <p className="text-charcoal-muted truncate text-xs" title={alt}>
                {alt || t('thumbnailAlt', { position: idx + 1 })}
              </p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => move(img.id, -1)}
                  disabled={isFirst || pending || heroPending !== null}
                  aria-label={t('moveEarlierAria', { position: idx + 1 })}
                  className="border-outline-variant/50 text-charcoal-muted hover:bg-canvas-sunken/50 border px-1.5 py-1 text-[0.7rem] disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(img.id, 1)}
                  disabled={isLast || pending || heroPending !== null}
                  aria-label={t('moveLaterAria', { position: idx + 1 })}
                  className="border-outline-variant/50 text-charcoal-muted hover:bg-canvas-sunken/50 border px-1.5 py-1 text-[0.7rem] disabled:opacity-30"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => setHero(img.id)}
                  disabled={isHero || pending || heroPending !== null}
                  className={cn(
                    'border px-2 py-1 text-[0.7rem] font-medium tracking-wide transition-colors',
                    isHero
                      ? 'border-brass/60 text-brass cursor-default'
                      : 'border-brass/40 text-brass hover:bg-brass/10',
                    'disabled:opacity-60',
                  )}
                >
                  {heroPending === img.id ? t('settingAsHero') : t('setAsHero')}
                </button>
              </div>
              <PropertyImageDeleteButton propertyId={propertyId} imageId={img.id} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
