/**
 * Suspense fallback for `/<locale>/admin/properties`.
 *
 * Adding `loading.tsx` is what lets Next App Router commit the URL
 * immediately on navigation: the segment suspends here while the real
 * `page.tsx` finishes its (Supabase-backed) data fetch. Without this
 * file, `router.push` blocks `history.pushState` until the destination
 * RSC is ready — which makes Playwright's `toHaveURL(...)` time out in
 * CI where the placeholder Supabase URL adds seconds to every query.
 *
 * Skeleton is intentionally minimal: a topbar block + a card-shaped
 * surface that mirrors the empty-state / table footprint. Keeps the
 * layout shift on real-content arrival imperceptible.
 */
export default function Loading() {
  return (
    <>
      <header className="bg-canvas-raised border-outline-variant/30 sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-6 md:px-10">
        <div className="space-y-2">
          <div className="bg-outline-variant/40 h-3 w-24 animate-pulse" />
          <div className="bg-outline-variant/60 h-7 w-64 animate-pulse" />
          <div className="bg-outline-variant/30 h-3 w-40 animate-pulse" />
        </div>
      </header>
      <div className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-screen-2xl">
          <div className="bg-canvas-raised border-outline-variant/30 h-48 animate-pulse border" />
        </div>
      </div>
    </>
  );
}
