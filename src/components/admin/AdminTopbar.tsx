import type { ReactNode } from 'react';

interface AdminTopbarProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Sticky page header for every admin route. Title + optional subtitle on
 * the start side, optional actions slot on the end side (where listings
 * will put a "+ Add New Property" button in PR 3.3).
 */
export function AdminTopbar({ eyebrow, title, subtitle, actions }: AdminTopbarProps) {
  return (
    <header className="bg-canvas-raised border-outline-variant/30 sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-6 md:px-10">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-brass-700 text-xs font-medium tracking-[0.2em] uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-teal-forest-700 text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle ? <p className="text-charcoal-muted text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  );
}
