import type { ReactNode } from 'react';

interface AdminPlaceholderProps {
  /** Short upper-case tag rendered before the title (e.g. "Coming soon"). */
  eyebrow: string;
  body: ReactNode;
  /** Optional badge naming the PR that will fill this surface (e.g. "PR 3.3"). */
  prTag?: string;
}

/**
 * Reusable empty-state for admin pages that ship as nav placeholders in
 * PR 3.2 and get their real implementation in a subsequent Phase 3 PR.
 *
 * Keeps the shell deployable today (every nav target resolves to a real
 * page) without forcing each placeholder to re-implement layout chrome.
 */
export function AdminPlaceholder({ eyebrow, body, prTag }: AdminPlaceholderProps) {
  return (
    <section className="bg-canvas-raised border-outline-variant/30 mx-auto mt-8 max-w-3xl border p-10">
      <p className="text-brass-600 mb-2 text-xs font-medium tracking-[0.2em] uppercase">
        {eyebrow}
      </p>
      <div className="text-charcoal space-y-3 text-base leading-relaxed">{body}</div>
      {prTag ? (
        <p className="border-outline-variant/40 text-charcoal-muted mt-6 border-t pt-4 text-xs">
          Tracking: {prTag}
        </p>
      ) : null}
    </section>
  );
}
