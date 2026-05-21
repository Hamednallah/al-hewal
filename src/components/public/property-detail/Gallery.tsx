'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type Locale } from '@/i18n/routing';
import type { PropertyImage } from '@/lib/data/properties';
import { cn } from '@/lib/utils';

/**
 * Property gallery: single-image slideshow on the page with prev/next
 * controls and dot indicators, plus a Radix Dialog lightbox for
 * fullscreen viewing.
 *
 * Replaces the previous hero + thumbnails masonry grid. The slideshow
 * surfaces one large image at a time so visitors browse intentionally;
 * the dot strip below previews how many photos exist; the click-to-zoom
 * lightbox keeps the fullscreen affordance.
 *
 * RTL:
 *   - Arrow icons mirror via `rtl:rotate-180` so they always point in
 *     the reading direction.
 *   - Arrow keys in the lightbox: in Arabic, `←` advances; in English
 *     `→` advances. Mirrors the chevron mapping.
 *
 * Touch:
 *   - Horizontal swipe on the active image triggers prev/next. Mostly-
 *     vertical drags are ignored so the page can still scroll.
 */
type GalleryProps = {
  images: PropertyImage[];
  locale: Locale;
};

// Pixels of horizontal travel required to treat a swipe as a slide change.
// Smaller values trigger accidental changes; larger ones feel unresponsive.
const SWIPE_THRESHOLD_PX = 50;

export function Gallery({ images, locale }: GalleryProps) {
  const t = useTranslations('public.propertyDetail.gallery');
  const isAr = locale === 'ar';
  const [current, setCurrent] = useState(0);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);
  const heroButtonRef = useRef<HTMLButtonElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const total = images.length;
  const safeTotal = Math.max(1, total);

  const goNext = useCallback(() => {
    setCurrent((i) => (i + 1) % safeTotal);
  }, [safeTotal]);
  const goPrev = useCallback(() => {
    setCurrent((i) => (i - 1 + safeTotal) % safeTotal);
  }, [safeTotal]);

  const lightboxNext = useCallback(() => {
    setLightboxAt((i) => (i == null ? null : (i + 1) % safeTotal));
  }, [safeTotal]);
  const lightboxPrev = useCallback(() => {
    setLightboxAt((i) => (i == null ? null : (i - 1 + safeTotal) % safeTotal));
  }, [safeTotal]);

  // Arrow-key navigation inside the lightbox only — the on-page
  // slideshow does not steal global key events.
  useEffect(() => {
    if (lightboxAt == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isAr) lightboxPrev();
        else lightboxNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isAr) lightboxNext();
        else lightboxPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxAt, isAr, lightboxNext, lightboxPrev]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    if (!t0) return;
    touchStartXRef.current = t0.clientX;
    touchStartYRef.current = t0.clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const x0 = touchStartXRef.current;
    const y0 = touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    if (x0 == null || y0 == null) return;
    const t1 = e.changedTouches[0];
    if (!t1) return;
    const dx = t1.clientX - x0;
    const dy = t1.clientY - y0;
    // Mostly-vertical drag — let the page scroll instead of stealing the gesture.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dy) > Math.abs(dx)) return;
    const swipeRight = dx > 0;
    // LTR: swipe-right means "go back" (older image); RTL flips it.
    if (swipeRight) {
      if (isAr) goNext();
      else goPrev();
    } else {
      if (isAr) goPrev();
      else goNext();
    }
  };

  if (total === 0) {
    return (
      <div className="border-outline-variant bg-canvas-sunken text-charcoal-muted flex aspect-[16/9] w-full items-center justify-center border">
        <span className="text-xs tracking-[0.25em] uppercase">{t('noImages')}</span>
      </div>
    );
  }

  const altOf = (img: PropertyImage) => (isAr ? img.alt_ar : img.alt_en);
  // `total > 0` is enforced by the early return above; the modulo math
  // keeps `current` in range. Use a non-null assertion so TS narrows
  // away the `| undefined` from `noUncheckedIndexedAccess`.
  const active = images[current]!;
  const activeLightboxImage = lightboxAt != null ? (images[lightboxAt] ?? null) : null;

  return (
    <>
      <div className="flex flex-col gap-4 md:gap-6">
        <div
          className="relative w-full overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-roledescription="carousel"
          aria-label={t('carousel')}
        >
          <button
            ref={heroButtonRef}
            type="button"
            onClick={() => setLightboxAt(current)}
            aria-label={t('openLightbox', { index: current + 1 })}
            className="group focus-visible:ring-brass-400 focus-visible:ring-offset-canvas relative block w-full overflow-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Image
              key={active.id}
              src={active.blob_url}
              alt={altOf(active)}
              width={active.width}
              height={active.height}
              priority={current === 0}
              sizes="(min-width: 1024px) 80vw, 100vw"
              className="aspect-[16/10] w-full object-cover md:aspect-[16/9]"
            />
            <span className="bg-teal-forest-900/70 text-canvas absolute end-3 top-3 px-2 py-1 text-xs font-semibold tracking-[0.2em] uppercase">
              {t('counter', { current: current + 1, total })}
            </span>
          </button>

          {total > 1 ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label={t('previous')}
                className="text-canvas hover:text-brass-400 focus-visible:ring-brass-400 focus-visible:ring-offset-canvas absolute start-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-teal-forest-900/70 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:start-4"
              >
                <ChevronIcon direction="prev" className="rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label={t('next')}
                className="text-canvas hover:text-brass-400 focus-visible:ring-brass-400 focus-visible:ring-offset-canvas absolute end-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-teal-forest-900/70 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:end-4"
              >
                <ChevronIcon direction="next" className="rtl:rotate-180" />
              </button>
            </>
          ) : null}
        </div>

        {total > 1 ? (
          <div
            role="tablist"
            aria-label={t('selectImage')}
            className="flex items-center justify-center gap-2"
          >
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={t('goToImage', { index: i + 1 })}
                onClick={() => setCurrent(i)}
                className={cn(
                  'h-2 w-8 transition-colors',
                  i === current
                    ? 'bg-brass-400'
                    : 'bg-charcoal-muted/30 hover:bg-charcoal-muted/60',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      <Dialog.Root
        open={lightboxAt != null}
        onOpenChange={(o) => {
          if (!o) {
            queueMicrotask(() => heroButtonRef.current?.focus());
            setLightboxAt(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              'bg-teal-forest-900/90 fixed inset-0 z-50 backdrop-blur-sm',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            )}
          />
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              'text-canvas fixed inset-0 z-50 flex flex-col focus:outline-none',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            )}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 md:px-10">
              <Dialog.Title className="text-canvas/80 text-xs tracking-[0.3em] uppercase">
                {activeLightboxImage
                  ? t('counter', { current: (lightboxAt ?? 0) + 1, total })
                  : ''}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label={t('close')}
                  className="text-canvas hover:text-brass-400 focus-visible:ring-brass-400 focus-visible:ring-offset-teal-forest-900 -me-2 inline-flex h-10 w-10 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <CloseIcon />
                </button>
              </Dialog.Close>
            </div>
            <div className="relative flex flex-1 items-center justify-center px-4 pb-4 md:px-10 md:pb-10">
              {activeLightboxImage ? (
                <Image
                  key={activeLightboxImage.id}
                  src={activeLightboxImage.blob_url}
                  alt={altOf(activeLightboxImage)}
                  width={activeLightboxImage.width}
                  height={activeLightboxImage.height}
                  sizes="(min-width: 1024px) 80vw, 100vw"
                  className="max-h-full max-w-full object-contain"
                  priority
                />
              ) : null}

              {total > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={lightboxPrev}
                    aria-label={t('previous')}
                    className="text-canvas hover:text-brass-400 focus-visible:ring-brass-400 focus-visible:ring-offset-teal-forest-900 bg-teal-forest-900/70 absolute start-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:start-10"
                  >
                    <ChevronIcon direction="prev" className="rtl:rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={lightboxNext}
                    aria-label={t('next')}
                    className="text-canvas hover:text-brass-400 focus-visible:ring-brass-400 focus-visible:ring-offset-teal-forest-900 bg-teal-forest-900/70 absolute end-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:end-10"
                  >
                    <ChevronIcon direction="next" className="rtl:rotate-180" />
                  </button>
                </>
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="13" y2="13" />
      <line x1="13" y1="1" x2="1" y2="13" />
    </svg>
  );
}

function ChevronIcon({
  direction,
  className,
}: {
  direction: 'prev' | 'next';
  className?: string;
}) {
  const d = direction === 'next' ? 'M5 2 L11 8 L5 14' : 'M9 2 L3 8 L9 14';
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
