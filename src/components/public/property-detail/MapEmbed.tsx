import { useTranslations } from 'next-intl';

import { type Locale } from '@/i18n/routing';

/**
 * Google Maps iframe embed for the property detail page.
 *
 * Why iframe (replacing the previous maplibre-gl + Carto Basemaps stack):
 *   - Zero client JS for the map: no 250 KB maplibre bundle, no hydration,
 *     no IntersectionObserver gating that left users staring at an empty
 *     teal placeholder when tiles failed to render in KSA.
 *   - Reliable for the Saudi audience: Google Maps' tile network performs
 *     well in-region; Carto's intermittently did not.
 *   - Matches the data model: admins already paste `maps.app.goo.gl`
 *     share URLs, so Google Maps is the familiar source of truth.
 *   - No API key, no business account: the `output=embed` query parameter
 *     is the standard keyless embed Google has supported for years. The
 *     official Embed API (key-gated) is unnecessary for our usage.
 *
 * Behaviour:
 *   - When `lat`/`lng` are both present, render the iframe centred on
 *     them, plus the "Open in Google Maps" link below using
 *     `googleMapsUrl` (admin-supplied share URL) when available.
 *   - When coords are missing, render a textual fallback. The caller
 *     (property detail page) currently hides the section entirely in
 *     that case, but the fallback stays as defensive UI in case the
 *     section is later shown for the URL-only path.
 */
type MapEmbedProps = {
  lat: number | null;
  lng: number | null;
  label: string;
  locale: Locale;
  googleMapsUrl?: string | null;
};

export function MapEmbed({ lat, lng, label, locale, googleMapsUrl }: MapEmbedProps) {
  const t = useTranslations('public.propertyDetail.map');
  const hasCoords = lat != null && lng != null;

  if (!hasCoords) {
    return (
      <div className="border-outline-variant bg-canvas-sunken text-charcoal-muted flex h-64 flex-col items-center justify-center gap-3 border p-6 text-center text-sm">
        {googleMapsUrl ? (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-forest-700 hover:text-brass-600 text-sm font-semibold tracking-[0.2em] uppercase"
          >
            {t('openInMaps')} →
          </a>
        ) : (
          <p>{t('fallbackNoCoords')}</p>
        )}
      </div>
    );
  }

  // `output=embed` is Google's long-standing keyless embed parameter.
  // `hl` localises the map's labels to match the page locale.
  // `z=16` is street-level zoom — close enough to show the building
  // context but wide enough to anchor the property in its district.
  const embedUrl = `https://www.google.com/maps?q=${lat},${lng}&hl=${locale}&z=16&output=embed`;

  return (
    <div className="bg-canvas-deep border-outline-variant border p-3 md:p-4">
      <iframe
        src={embedUrl}
        title={label}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allow="fullscreen"
        className="block h-[320px] w-full border-0 md:h-[420px]"
      />
      {googleMapsUrl ? (
        <div className="mt-3 text-end">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-forest-700 hover:text-brass-600 text-sm font-semibold tracking-[0.2em] uppercase"
          >
            {t('openInMaps')} →
          </a>
        </div>
      ) : null}
    </div>
  );
}
