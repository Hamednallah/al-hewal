import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AmenitiesList } from '@/components/public/property-detail/AmenitiesList';
import { Brief } from '@/components/public/property-detail/Brief';
import { ContactCard } from '@/components/public/property-detail/ContactCard';
import { Gallery } from '@/components/public/property-detail/Gallery';
import { MapEmbed } from '@/components/public/property-detail/MapEmbed';
import { MobileContactBar } from '@/components/public/property-detail/MobileContactBar';
import { Specs } from '@/components/public/property-detail/Specs';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { getPropertyBySlug } from '@/lib/data/properties';
import { env } from '@/lib/env';
import { formatPrice } from '@/lib/format';

/**
 * Property detail page — `/<locale>/properties/[slug]`.
 *
 * Static-at-build for known slugs (via generateStaticParams), then ISR
 * (revalidate=86400, 24h). PR 2.5 will call revalidateTag from admin
 * mutations so a freshly-published property surfaces immediately.
 *
 * Composition order:
 *   1. Header (eyebrow + title + location + price)
 *   2. Gallery (masonry + lightbox)
 *   3. Two-column body: Specs + Brief + Amenities | sticky ContactCard
 *   4. MapEmbed (lazy)
 *   5. MobileContactBar (fixed, mobile only)
 *
 * Emits JSON-LD `RealEstateListing` schema inline so Google Rich
 * Results can verify it. Required fields: name, description, address,
 * geo, image, offers (with priceCurrency=SAR).
 */
// force-dynamic. PR #27 tried `revalidate=60 + generateStaticParams`
// per the "prefer revalidate over force-dynamic" rule, but production
// proved the rule wrong for THIS page: Vercel's CDN edge cache kept
// returning `Cache: HIT` on /404 responses even after the 60s window
// elapsed and `revalidatePath` had fired. Multiple post-#27 logs
// confirmed `404 Cache: HIT` for slugs whose underlying property was
// already published. Going back to `force-dynamic` (the PR #26 fix
// that owner-tested green) — every request hits Supabase fresh, no
// cached miss windows. Free-tier impact at ~50 properties + modest
// KSA traffic stays inside the 100k/mo Function cap by orders of
// magnitude.
export const dynamic = 'force-dynamic';

type PageParams = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property) return { title: 'Not found' };

  const t = await getTranslations({
    locale,
    namespace: 'public.propertyDetail.metadata',
  });
  const isAr = locale === 'ar';
  const title = isAr ? property.title_ar : property.title_en;
  const description = isAr ? property.description_ar : property.description_en;
  const summary = description.length > 140 ? description.slice(0, 137) + '…' : description;
  const location = property.district
    ? isAr
      ? `${property.district}، ${property.city}`
      : `${property.district}, ${property.city}`
    : property.city;
  const price = formatPrice(property.price_sar, locale as Locale);
  const hero = property.images.find((img) => img.is_hero) ?? property.images[0];
  const canonical = `${env.NEXT_PUBLIC_SITE_URL}/${locale}/properties/${slug}`;
  const altLocale = locale === 'ar' ? 'en' : 'ar';

  return {
    title: t('titleTemplate', { title }),
    description: t('description', { title, summary, location, price }),
    alternates: {
      canonical,
      languages: {
        [locale]: canonical,
        [altLocale]: `${env.NEXT_PUBLIC_SITE_URL}/${altLocale}/properties/${slug}`,
      },
    },
    openGraph: {
      title: t('titleTemplate', { title }),
      description: t('description', { title, summary, location, price }),
      url: canonical,
      locale,
      type: 'article',
      images: hero
        ? [
            {
              url: hero.blob_url,
              width: hero.width,
              height: hero.height,
              alt: isAr ? hero.alt_ar : hero.alt_en,
            },
          ]
        : undefined,
    },
  };
}

export default async function PropertyDetailPage({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;
  const property = await getPropertyBySlug(slug);
  if (!property) notFound();

  const [t, tProperty] = await Promise.all([
    getTranslations({ locale, namespace: 'public.propertyDetail' }),
    getTranslations({ locale, namespace: 'public.property' }),
  ]);

  const isAr = locale === 'ar';
  const title = isAr ? property.title_ar : property.title_en;
  const location = property.district
    ? t('locationWithDistrict', { district: property.district, city: property.city })
    : t('locationFallback', { city: property.city });
  const url = `${env.NEXT_PUBLIC_SITE_URL}/${locale}/properties/${slug}`;
  const price = formatPrice(property.price_sar, typedLocale);
  const whatsappPhone = env.NEXT_PUBLIC_WHATSAPP_PHONE;

  const jsonLd = buildJsonLd({
    property,
    title,
    description: isAr ? property.description_ar : property.description_en,
    url,
    locale,
  });

  return (
    <>
      <script
        type="application/ld+json"
        // The payload is generated server-side from typed data, not from
        // user input — safe to render as-is. dangerouslySetInnerHTML is
        // the only way to emit raw JSON inside <script>.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="pb-24 md:pb-0">
        <div className="bg-canvas">
          <div className="px-edge mx-auto max-w-[1440px] py-10 md:py-16">
            <nav className="mb-8 text-sm tracking-[0.25em] uppercase">
              <Link
                href="/properties"
                className="text-charcoal-muted hover:text-teal-forest-700 focus-visible:underline focus-visible:outline-none"
              >
                ← {t('back')}
              </Link>
            </nav>

            <header className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between md:gap-10">
              <div className="max-w-2xl">
                <h1 className="text-teal-forest-700 mb-3 text-4xl leading-tight font-bold md:text-5xl lg:text-6xl">
                  {title}
                </h1>
                <p className="text-charcoal-muted flex items-center gap-2 text-base md:text-lg">
                  <LocationIcon />
                  <span>{location}</span>
                </p>
              </div>
              <div className="flex flex-col md:items-end">
                <p className="text-charcoal-muted mb-1 text-sm tracking-[0.2em] uppercase">
                  {t('startingPrice')}
                  {property.price_negotiable ? ` · ${t('negotiable')}` : null}
                </p>
                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <p className="text-teal-forest-700 text-2xl font-bold md:text-3xl">{price}</p>
                  <span className="bg-brass-400 text-teal-forest-700 inline-block px-3 py-1 text-sm font-bold tracking-[0.25em] uppercase">
                    {tProperty(`status.${property.status}`)}
                  </span>
                </div>
              </div>
            </header>

            <Gallery images={property.images} locale={typedLocale} />
          </div>
        </div>

        <div className="bg-canvas">
          <div className="px-edge mx-auto grid max-w-[1440px] grid-cols-1 gap-12 py-12 md:grid-cols-12 md:gap-10 md:py-20">
            <div className="flex flex-col gap-12 md:col-span-7 md:gap-16 lg:col-span-8">
              <Specs property={property} locale={typedLocale} />
              <Brief property={property} locale={typedLocale} />
              <AmenitiesList amenities={property.amenities} locale={typedLocale} />
            </div>
            <div className="md:col-span-5 lg:col-span-4">
              <div className="md:sticky md:top-28">
                <ContactCard
                  title={title}
                  slug={slug}
                  whatsappPhone={whatsappPhone}
                  locale={typedLocale}
                />
              </div>
            </div>
          </div>
        </div>

        {property.lat != null && property.lng != null ? (
          <div className="bg-canvas">
            <div className="px-edge mx-auto max-w-[1440px] pb-16 md:pb-24">
              <h2 className="text-teal-forest-700 mb-6 text-2xl font-semibold md:text-3xl">
                {t('map.title')}
              </h2>
              <MapEmbed
                lat={property.lat}
                lng={property.lng}
                label={title}
                locale={typedLocale}
                googleMapsUrl={property.google_maps_url}
              />
            </div>
          </div>
        ) : null}

        <div className="bg-canvas px-edge mx-auto hidden max-w-[1440px] pb-16 md:block">
          <Button asChild variant="outline" size="md">
            <Link href="/properties">← {t('back')}</Link>
          </Button>
        </div>
      </article>

      <MobileContactBar
        title={title}
        slug={slug}
        whatsappPhone={whatsappPhone}
        locale={typedLocale}
      />
    </>
  );
}

function LocationIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M9 1 a6 6 0 0 1 6 6 c0 5 -6 10 -6 10 S3 12 3 7 a6 6 0 0 1 6 -6 Z" />
      <circle cx="9" cy="7" r="2" />
    </svg>
  );
}

type JsonLdInput = {
  property: Awaited<ReturnType<typeof getPropertyBySlug>>;
  title: string;
  description: string;
  url: string;
  locale: string;
};

/**
 * Build the JSON-LD payload Google reads.
 *
 * Shape:
 *   - Outer `@type: RealEstateListing` (schema.org/RealEstateListing) —
 *     the type the handoff specifies and what Google's Rich Results
 *     validator recognises for property listings.
 *   - `about` carries the physical residence via `Accommodation` —
 *     `RealEstateListing` itself is a CreativeWork and doesn't define
 *     floorSize / numberOfBedrooms; those live on Accommodation.
 *   - `offers` carries the price + currency + availability mapping
 *     from `property_status`.
 *
 * The validator at https://search.google.com/test/rich-results will
 * accept this shape. Required fields per the handoff: name, description,
 * address, geo, price (SAR), image array, datePosted, availability.
 */
function buildJsonLd({ property, title, description, url, locale }: JsonLdInput) {
  if (!property) return {};
  const hero = property.images.find((img) => img.is_hero) ?? property.images[0];
  const availability =
    property.status === 'available'
      ? 'https://schema.org/InStock'
      : property.status === 'reserved'
        ? 'https://schema.org/LimitedAvailability'
        : property.status === 'sold'
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/PreOrder';

  const accommodationType =
    property.type === 'villa'
      ? 'SingleFamilyResidence'
      : property.type === 'apartment'
        ? 'Apartment'
        : property.type === 'duplex'
          ? 'House'
          : 'Accommodation';

  const address = {
    '@type': 'PostalAddress',
    addressCountry: 'SA',
    addressLocality: property.city,
    ...(property.district ? { addressRegion: property.district } : {}),
  };

  const geo =
    property.lat != null && property.lng != null
      ? {
          '@type': 'GeoCoordinates',
          latitude: property.lat,
          longitude: property.lng,
        }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: title,
    description,
    url,
    inLanguage: locale,
    image: property.images.map((img) => img.blob_url),
    datePosted: property.created_at,
    dateModified: property.updated_at,
    ...(hero
      ? {
          primaryImageOfPage: {
            '@type': 'ImageObject',
            contentUrl: hero.blob_url,
            width: hero.width,
            height: hero.height,
          },
        }
      : {}),
    about: {
      '@type': accommodationType,
      name: title,
      address,
      ...(geo ? { geo } : {}),
      floorSize: {
        '@type': 'QuantitativeValue',
        value: property.area_sqm,
        unitCode: 'MTK', // ISO 31-11: square metres
      },
      numberOfBedrooms: property.bedrooms,
      numberOfBathroomsTotal: property.bathrooms,
      amenityFeature: property.amenities.map((a) => ({
        '@type': 'LocationFeatureSpecification',
        name: locale === 'ar' ? a.label_ar : a.label_en,
        value: true,
      })),
    },
    offers: {
      '@type': 'Offer',
      price: property.price_sar,
      priceCurrency: 'SAR',
      availability,
      url,
      seller: { '@type': 'Organization', name: 'Al Haual' },
    },
  };
}
