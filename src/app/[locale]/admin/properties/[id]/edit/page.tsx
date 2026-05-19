import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { PropertyDraftBanner } from '@/components/admin/PropertyDraftBanner';
import { PropertyForm } from '@/components/admin/PropertyForm';
import { PropertyImagesGrid } from '@/components/admin/PropertyImagesGrid';
import { PropertyImageUploader } from '@/components/admin/PropertyImageUploader';
import { type Locale, routing } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admins';
import { getAdminPropertyById, listPropertyImages } from '@/lib/data/admin-properties';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return { robots: { index: false, follow: false } };
  }
  const t = await getTranslations({ locale, namespace: 'admin.properties.form' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditPropertyPage({ params }: PageProps) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await requireAdmin();
  const typedLocale = locale as Locale;

  const [property, images, t, tCommon] = await Promise.all([
    getAdminPropertyById(id),
    listPropertyImages(id),
    getTranslations({ locale: typedLocale, namespace: 'admin.properties.form' }),
    getTranslations({ locale: typedLocale, namespace: 'admin.common' }),
  ]);

  if (!property) notFound();

  // Compute the next position so a fresh upload appends to the end of
  // the gallery. Reorder UI lands in PR 3.5c.
  const nextPosition = images.length > 0 ? Math.max(...images.map((i) => i.position)) + 1 : 0;

  // The form expects string-friendly initial values for the numeric/
  // optional fields (so an empty input stays empty instead of "0").
  const initialValues = {
    slug: property.slug,
    title_ar: property.title_ar,
    title_en: property.title_en,
    description_ar: property.description_ar,
    description_en: property.description_en,
    type: property.type,
    status: property.status,
    price_sar: property.price_sar,
    price_negotiable: property.price_negotiable,
    area_sqm: property.area_sqm,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    city: property.city,
    district: property.district ?? '',
    plot_number: property.plot_number ?? '',
    street_width_m: property.street_width_m ?? '',
    facade: property.facade ?? '',
    lat: property.lat ?? '',
    lng: property.lng ?? '',
    google_maps_url: property.google_maps_url ?? '',
    featured: property.featured,
  } as const;

  return (
    <>
      <AdminTopbar
        eyebrow={tCommon('section')}
        title={t('editTitle')}
        subtitle={t('editSubtitle', {
          title: typedLocale === 'ar' ? property.title_ar : property.title_en,
        })}
      />
      <div className="mx-auto mt-6 mb-12 max-w-5xl space-y-4">
        {property.status === 'draft' && property.deleted_at === null ? (
          <PropertyDraftBanner
            propertyId={property.id}
            publicHref={`/${typedLocale}/properties/${property.slug}`}
          />
        ) : null}
        <div className="bg-canvas-raised border-outline-variant/30 border">
          <PropertyForm
            locale={typedLocale}
            mode="edit"
            propertyId={property.id}
            initialValues={initialValues}
            imagesSlot={
              <div className="space-y-6">
                <PropertyImagesGrid locale={typedLocale} propertyId={property.id} images={images} />
                <PropertyImageUploader propertyId={property.id} nextPosition={nextPosition} />
              </div>
            }
          />
        </div>
      </div>
    </>
  );
}
