/**
 * Inline-SVG icon set for property amenities.
 *
 * One stroke-based pictogram per `amenities.icon` value stored in the
 * database. Designed to match `Specs.tsx`'s inline-SVG approach so the
 * detail page stays free of the ~120 KB Material Symbols font payload
 * (see `web/performance.md` budget).
 *
 * Visual language:
 *   - 16 unit viewBox, currentColor stroke, 1.75 stroke-width
 *   - square linecaps + miter joins (matches the page's sharp-corner
 *     architecture in `DESIGN.md`)
 *   - Decorative only (aria-hidden); labels carry the meaning
 *
 * Fallback: unknown icon names fall through to the `check` glyph so a
 * future admin-added amenity won't break the page if a matching icon
 * hasn't been authored yet.
 */
import type { ReactElement } from 'react';

type IconRender = () => ReactElement;

const ICONS: Record<string, IconRender> = {
  // Fallback — also used as the default if `amenities.icon` is missing.
  check: () => <path d="M2 8 L7 13 L14 4" />,

  // ---- Interior --------------------------------------------------------
  bed: () => (
    <>
      <path d="M1 13 H15" />
      <path d="M1 9 H15 V13" />
      <path d="M3 9 V7 H8 V9" />
    </>
  ),
  weekend: () => (
    <>
      <rect x="2" y="5" width="12" height="4" />
      <rect x="1" y="9" width="14" height="4" />
      <path d="M3 13 V14 M13 13 V14" />
    </>
  ),
  chair: () => (
    <>
      <path d="M4 2 V13" />
      <path d="M12 6 V13" />
      <path d="M4 8 H12" />
      <path d="M4 13 L3 15 M12 13 L13 15" />
    </>
  ),
  desk: () => (
    <>
      <path d="M1 6 H15" />
      <path d="M2 6 V14 M14 6 V14" />
      <path d="M2 10 H8" />
    </>
  ),
  crib: () => (
    <>
      <rect x="2" y="6" width="12" height="8" />
      <path d="M5 6 V14 M8 6 V14 M11 6 V14" />
    </>
  ),
  checkroom: () => (
    <>
      <path d="M8 5 Q8 3 9.5 3" />
      <path d="M8 5 V8" />
      <path d="M1 12 L8 8 L15 12" />
      <path d="M1 12 H15" />
    </>
  ),
  kitchen: () => (
    <>
      <path d="M3 2 V6 M13 2 V6" />
      <path d="M2 6 H14" />
      <rect x="3" y="6" width="10" height="7" />
    </>
  ),
  restaurant: () => (
    <>
      <path d="M4 2 V14" />
      <path d="M3 2 V6 H5 V2" />
      <path d="M12 2 V14" />
      <rect x="10" y="3" width="4" height="4" />
    </>
  ),
  warehouse: () => (
    <>
      <rect x="2" y="3" width="12" height="11" />
      <path d="M2 7 H14" />
      <path d="M6 3 V7 M10 3 V7" />
    </>
  ),
  local_laundry_service: () => (
    <>
      <rect x="2" y="2" width="12" height="13" />
      <circle cx="8" cy="9" r="3" />
      <path d="M4 4.5 H6 M11 4.5 H12" />
    </>
  ),
  elevator: () => (
    <>
      <rect x="3" y="1" width="10" height="14" />
      <path d="M8 1 V15" />
      <path d="M5 5 L6 3 L7 5" />
      <path d="M9 11 L10 13 L11 11" />
    </>
  ),

  // ---- Exterior --------------------------------------------------------
  park: () => (
    <>
      <path d="M8 14 V8" />
      <path d="M4 9 L8 2 L12 9 Z" />
    </>
  ),
  pool: () => (
    <>
      <polyline points="1 8 4 6 7 8 10 6 13 8" />
      <polyline points="1 12 4 10 7 12 10 10 13 12" />
    </>
  ),
  balcony: () => (
    <>
      <path d="M1 6 H15" />
      <path d="M1 13 H15" />
      <path d="M3 6 V13 M6 6 V13 M9 6 V13 M12 6 V13" />
    </>
  ),
  deck: () => (
    <>
      <rect x="2" y="3" width="12" height="3" />
      <rect x="2" y="7" width="12" height="3" />
      <rect x="2" y="11" width="12" height="3" />
    </>
  ),

  // ---- Safety / structural --------------------------------------------
  lock: () => (
    <>
      <rect x="3" y="7" width="10" height="7" />
      <path d="M5 7 V5 Q5 2 8 2 Q11 2 11 5 V7" />
    </>
  ),
  videocam: () => (
    <>
      <rect x="2" y="5" width="9" height="6" />
      <path d="M11 7 L15 5 V11 L11 9 Z" />
    </>
  ),
  verified: () => (
    <>
      <path d="M8 1 L14 4 V8 Q14 13 8 15 Q2 13 2 8 V4 Z" />
      <path d="M5 8 L7 10 L11 6" />
    </>
  ),
  verified_user: () => (
    <>
      <path d="M8 1 L14 4 V8 Q14 13 8 15 Q2 13 2 8 V4 Z" />
      <circle cx="8" cy="7" r="1.5" />
      <path d="M5 12 Q6 10 8 10 Q10 10 11 12" />
    </>
  ),
  door_front: () => (
    <>
      <rect x="3" y="1" width="10" height="14" />
      <circle cx="11" cy="8" r="0.5" />
    </>
  ),

  // ---- Smart / utility -------------------------------------------------
  water_drop: () => <path d="M8 2 L4 9 Q4 13 8 13 Q12 13 12 9 Z" />,
  design_services: () => (
    <>
      <path d="M2 14 L13 3" />
      <path d="M10 2 L14 2 V6" />
      <path d="M11 5 L13 3" />
    </>
  ),
  home_iot_device: () => (
    <>
      <path d="M2 8 L8 2 L14 8" />
      <path d="M3 8 V14 H13 V8" />
      <circle cx="8" cy="11" r="0.7" />
    </>
  ),
  mode_fan: () => (
    <>
      <circle cx="8" cy="8" r="1.5" />
      <path d="M8 6 V1 M8 10 V15 M6 8 H1 M10 8 H15" />
    </>
  ),
  directions_car: () => (
    <>
      <path d="M2 11 H14 V8 L12 5 H4 L2 8 Z" />
      <circle cx="5" cy="11" r="1.2" />
      <circle cx="11" cy="11" r="1.2" />
    </>
  ),
  solar_power: () => (
    <>
      <rect x="2" y="2" width="12" height="12" />
      <path d="M2 6 H14 M2 10 H14" />
      <path d="M6 2 V14 M10 2 V14" />
    </>
  ),
};

type AmenityIconProps = {
  /** `amenities.icon` value from the database. Falls back to a check
   *  glyph if no matching pictogram exists in the dictionary. */
  icon: string;
  /** Rendered size in pixels (square). Default 20 — matches the row
   *  height of the amenity label next to it. */
  size?: number;
  className?: string;
};

export function AmenityIcon({ icon, size = 20, className }: AmenityIconProps) {
  const render = ICONS[icon] ?? ICONS.check!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      {render()}
    </svg>
  );
}
