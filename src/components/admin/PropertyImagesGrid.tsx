import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import type { AdminPropertyImageRow } from '@/lib/data/admin-properties';

import { PropertyImageDeleteButton } from './PropertyImageDeleteButton';

interface PropertyImagesGridProps {
  locale: Locale;
  propertyId: string;
  images: AdminPropertyImageRow[];
}

/**
 * Admin gallery for a single property's uploaded images (PR 3.5b).
 *
 * Renders a responsive grid of thumbnails using the AVIF + WebP
 * sources from `property_images`. The `<picture>` element lets the
 * browser pick the best available source — modern browsers grab AVIF,
 * old Safari/Firefox fall through to WebP, and any rows from before
 * PR 3.5b (no `webp_url`) display via the AVIF URL only.
 *
 * Each tile shows the bilingual alt text in the current locale and a
 * delete button (any active admin). Reorder + hero-pick UI are queued
 * for PR 3.5c — for now `position` is set by the uploader (next
 * available index) and not editable here.
 */
export async function PropertyImagesGrid({ locale, propertyId, images }: PropertyImagesGridProps) {
  const t = await getTranslations({ locale, namespace: 'admin.properties.images' });

  if (images.length === 0) {
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
      <p className="text-charcoal-muted text-xs">{t('imagesCount', { count: images.length })}</p>
      <ul
        data-testid="property-images-grid"
        className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
      >
        {images.map((img) => {
          const alt = locale === 'ar' ? img.alt_ar : img.alt_en;
          return (
            <li
              key={img.id}
              className="bg-canvas border-outline-variant/30 flex flex-col gap-2 border p-2"
            >
              <picture>
                {img.webp_url ? <source srcSet={img.webp_url} type="image/webp" /> : null}
                <source srcSet={img.blob_url} type="image/avif" />
                <img
                  src={img.blob_url}
                  alt={alt || t('thumbnailAlt', { position: img.position + 1 })}
                  width={img.width}
                  height={img.height}
                  loading="lazy"
                  className="aspect-[4/3] h-auto w-full object-cover"
                />
              </picture>
              <p className="text-charcoal-muted truncate text-xs" title={alt}>
                {alt || t('thumbnailAlt', { position: img.position + 1 })}
              </p>
              <PropertyImageDeleteButton propertyId={propertyId} imageId={img.id} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
