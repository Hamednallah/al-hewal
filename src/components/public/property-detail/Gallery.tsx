'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type Locale } from '@/i18n/routing';
import type { PropertyImage } from '@/lib/data/properties';
import { cn } from '@/lib/utils';

/**
 * Property gallery: hero + up-to-two thumbnails in a CSS Grid masonry
 * layout, with a Radix Dialog lightbox that supports keyboard nav
 * (arrows + Esc), focus trap, and focus restoration to the thumbnail
 * that opened it.
 *
 * Why CSS Grid (and not CSS columns): CSS columns reorder visually but
 * keep DOM order. For RTL, that creates a mismatch between the visual
 * tab order and the semantic order — keyboard users tab through cards
 * out-of-order. Grid with explicit areas keeps visual + DOM order in
 * sync, which is the accessibility rule from DESIGN.md.
 *
 * Tablet+ : hero on the inline-start (2/3 width × 2 rows), two thumbs
 *           stacked on the inline-end side. Matches the Stitch mockup.
 * Mobile  : hero full-width on top, two thumbs in a row below.
 *
 * The "+N photos" overlay sits on the last visible thumbnail when
 * `images.length > 3`, signalling there's more in the lightbox without
 * trying to render every thumbnail at the catalog density.
 */
type GalleryProps = {
  images: PropertyImage[];
  locale: Locale;
};

export function Gallery({ images, locale }: GalleryProps) {
  const t = useTranslations('public.propertyDetail.gallery');
  const isAr = locale === 'ar';
  const [openAt, setOpenAt] = useState<number | null>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // The three thumbnails actually rendered on the page (hero + up to 2
  // accents). The lightbox cycles through every image.
  const visible = images.slice(0, 3);
  const overflow = Math.max(0, images.length - 3);
  const lastIndex = visible.length - 1;

  const close = useCallback(() => setOpenAt(null), []);
  const next = useCallback(() => {
    setOpenAt((i) => (i == null ? null : (i + 1) % images.length));
  }, [images.length]);
  const prev = useCallback(() => {
    setOpenAt((i) => (i == null ? null : (i - 1 + images.length) % images.length));
  }, [images.length]);

  // Arrow-key navigation. Mirror prev/next for RTL so ← moves "forward"
  // in reading order when the user is in Arabic.
  useEffect(() => {
    if (openAt == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isAr) prev();
        else next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isAr) next();
        else prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAt, isAr, next, prev]);

  if (images.length === 0) {
    return (
      <div className="border-outline-variant bg-canvas-sunken text-charcoal-muted flex aspect-[16/9] w-full items-center justify-center border">
        <span className="text-xs uppercase tracking-[0.25em]">{t('noImages')}</span>
      </div>
    );
  }

  const altOf = (img: PropertyImage) => (isAr ? img.alt_ar : img.alt_en);
  const activeImage = openAt != null ? images[openAt] : null;

  return (
    <>
      <div
        className={cn(
          'grid w-full gap-3 md:gap-6',
          'grid-cols-2 grid-rows-[auto_auto] md:grid-cols-3 md:grid-rows-2',
        )}
      >
        {visible.map((img, idx) => {
          const isHero = idx === 0;
          const showOverflow = overflow > 0 && idx === lastIndex;
          return (
            <button
              key={img.id}
              ref={(el) => {
                triggerRefs.current[idx] = el;
              }}
              type="button"
              onClick={() => setOpenAt(idx)}
              aria-label={t('openLightbox', { index: idx + 1 })}
              className={cn(
                'group focus-visible:ring-brass-400 focus-visible:ring-offset-canvas relative block overflow-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                isHero
                  ? 'col-span-2 row-span-1 aspect-[16/10] md:col-span-2 md:row-span-2 md:aspect-auto md:h-[28rem] lg:h-[34rem]'
                  : 'col-span-1 row-span-1 aspect-[4/3] md:aspect-auto md:h-[13.5rem] lg:h-[16.5rem]',
              )}
            >
              <Image
                src={img.blob_url}
                alt={altOf(img)}
                width={img.width}
                height={img.height}
                priority={isHero}
                sizes={
                  isHero
                    ? '(min-width: 1024px) 66vw, 100vw'
                    : '(min-width: 1024px) 33vw, 50vw'
                }
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
              {showOverflow ? (
                <div className="bg-teal-forest-900/55 text-canvas absolute inset-0 flex items-center justify-center transition-colors group-hover:bg-teal-forest-900/70">
                  <span className="text-base font-semibold tracking-[0.15em] uppercase md:text-lg">
                    {t('morePhotos', { count: overflow })}
                  </span>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <Dialog.Root
        open={openAt != null}
        onOpenChange={(o) => {
          if (!o) {
            // Restore focus to the thumbnail that opened the lightbox
            // (Radix does the trigger-to-trigger return automatically when
            // we use Trigger; here we open programmatically, so we focus
            // the matching thumbnail in a microtask after close.)
            const fromIdx = openAt ?? 0;
            const restoreTarget = Math.min(fromIdx, lastIndex);
            queueMicrotask(() => triggerRefs.current[restoreTarget]?.focus());
            close();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              'fixed inset-0 z-50 bg-teal-forest-900/90 backdrop-blur-sm',
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
                {activeImage
                  ? t('counter', { current: (openAt ?? 0) + 1, total: images.length })
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
              {activeImage ? (
                <Image
                  key={activeImage.id}
                  src={activeImage.blob_url}
                  alt={altOf(activeImage)}
                  width={activeImage.width}
                  height={activeImage.height}
                  sizes="(min-width: 1024px) 80vw, 100vw"
                  className="max-h-full max-w-full object-contain"
                  priority
                />
              ) : null}

              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    aria-label={t('previous')}
                    className="text-canvas hover:text-brass-400 focus-visible:ring-brass-400 focus-visible:ring-offset-teal-forest-900 absolute start-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-teal-forest-900/70 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:start-10"
                  >
                    <ChevronIcon className="rtl:rotate-180" direction="prev" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    aria-label={t('next')}
                    className="text-canvas hover:text-brass-400 focus-visible:ring-brass-400 focus-visible:ring-offset-teal-forest-900 absolute end-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center bg-teal-forest-900/70 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:end-10"
                  >
                    <ChevronIcon className="rtl:rotate-180" direction="next" />
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
  // "next" points to the inline-end (right in LTR); "prev" to inline-start.
  // Both get rtl:rotate-180 from the parent so they mirror visually but
  // continue to mean "move forward/back in image order" semantically.
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
