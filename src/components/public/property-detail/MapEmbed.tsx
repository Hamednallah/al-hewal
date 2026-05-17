'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { type Locale } from '@/i18n/routing';
import { formatNumber } from '@/lib/format';

/**
 * Lazy MapLibre map for the property detail page.
 *
 * Two-stage load:
 *   1. The component renders a static teal placeholder server-side and on
 *      first paint. No map bundle is downloaded yet.
 *   2. When the placeholder scrolls into view (IntersectionObserver,
 *      200px rootMargin), we dynamic-import maplibre-gl + its CSS,
 *      then mount the map.
 *
 * This pattern keeps every page that *links* to the detail (catalog,
 * featured) free of the maplibre-gl bundle (~250 KB gzipped), and the
 * detail page itself doesn't pay for the map cost above the fold.
 *
 * If no coordinates exist (admin hasn't pinned the property yet), the
 * component returns a textual fallback rather than rendering an empty
 * map at the origin. Renders `null` when both `lat` and `lng` are null
 * AND no fallback URL — the caller is responsible for not showing the
 * section header in that case.
 *
 * Tile source: OpenStreetMap raster tiles via the demo style. Free, no
 * API key, attribution baked into the style. If the owner adds a Google
 * Maps key later, env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY can switch this
 * to a different provider without a schema change.
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapMountRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Coords missing entirely → render the textual fallback only.
  const hasCoords = lat != null && lng != null;

  useEffect(() => {
    if (!hasCoords) return;
    const node = containerRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasCoords]);

  useEffect(() => {
    if (!inView || !hasCoords) return;
    const mount = mapMountRef.current;
    if (!mount) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ default: maplibregl }] = await Promise.all([
        import('maplibre-gl'),
        // Side-effect import of MapLibre's CSS. Bundled but only when
        // this branch executes, so other routes don't pay for it.
        import('maplibre-gl/dist/maplibre-gl.css'),
      ]);
      if (cancelled) return;

      const map = new maplibregl.Map({
        container: mount,
        // Demo style hosted by MapLibre. Production-safe: rate-limits
        // are documented and we can swap to a self-hosted style or
        // MapTiler/Stadia when traffic warrants.
        style: 'https://demotiles.maplibre.org/style.json',
        center: [lng!, lat!],
        zoom: 13,
        attributionControl: false,
        cooperativeGestures: true,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-right',
      );

      const marker = new maplibregl.Marker({ color: '#D4B982' })
        .setLngLat([lng!, lat!])
        .setPopup(new maplibregl.Popup({ offset: 24, closeButton: false }).setText(label))
        .addTo(map);

      map.once('load', () => {
        if (!cancelled) setMapReady(true);
      });

      cleanup = () => {
        marker.remove();
        map.remove();
      };
    })().catch((err) => {
      console.warn('[MapEmbed] failed to load map:', err instanceof Error ? err.message : err);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [inView, hasCoords, lat, lng, label]);

  if (!hasCoords) {
    return (
      <div className="border-outline-variant bg-canvas-sunken text-charcoal-muted flex h-64 items-center justify-center border p-6 text-center text-sm">
        <p>{googleMapsUrl ?? t('fallback', { lat: '—', lng: '—' })}</p>
      </div>
    );
  }

  return (
    <div className="bg-canvas-deep border-outline-variant border p-3 md:p-4">
      <div
        ref={containerRef}
        className="bg-teal-forest-50 relative h-[320px] w-full md:h-[420px]"
      >
        <div ref={mapMountRef} className="absolute inset-0" aria-hidden={!mapReady} />
        {!mapReady ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <PinIcon />
            <span className="text-teal-forest-700 text-xs tracking-[0.2em] uppercase">
              {inView ? t('loading') : t('fallback', {
                lat: formatNumber(lat!, locale),
                lng: formatNumber(lng!, locale),
              })}
            </span>
          </div>
        ) : null}
      </div>
      {googleMapsUrl ? (
        <div className="mt-3 text-end">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-forest-700 hover:text-brass-600 text-xs font-semibold tracking-[0.2em] uppercase"
          >
            {t('openInMaps')} →
          </a>
        </div>
      ) : null}
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
      className="text-teal-forest-700/60"
    >
      <path d="M18 4 a10 10 0 0 1 10 10 c0 8 -10 18 -10 18 S8 22 8 14 a10 10 0 0 1 10 -10 Z" />
      <circle cx="18" cy="14" r="3" />
    </svg>
  );
}
