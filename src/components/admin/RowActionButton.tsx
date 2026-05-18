'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { cn } from '@/lib/utils';

interface RowActionButtonProps {
  /** Endpoint to POST/DELETE against. */
  href: string;
  /** HTTP method — `POST` for state-change actions, `DELETE` for hard delete. */
  method: 'POST' | 'DELETE';
  /** Visible label (and accessible name). */
  label: string;
  /**
   * If set, the user is prompted with a native `window.confirm` carrying
   * this message before the request fires. Used for destructive actions
   * (archive, delete).
   */
  confirmMessage?: string;
  /**
   * Optional JSON body to send. Only used when `method === 'POST'`.
   * Currently powers `/feature` (sends `{ featured: boolean }`).
   */
  body?: Record<string, unknown>;
  /** Tone — controls the muted vs destructive visual treatment. */
  tone?: 'default' | 'destructive';
  /** Message to surface in the inline error region when the request fails. */
  failureMessage: string;
}

/**
 * One-shot mutation button for the admin listings row actions
 * (PR 3.3b). Fires the request inside a transition so the listings
 * table re-fetches its server state via `router.refresh()` on success
 * without a hard reload.
 *
 * Destructive variants prompt with a confirmation dialog; the message
 * comes from props so the parent server component owns the bilingual
 * copy. On failure the button surfaces a small inline error region
 * that screen readers pick up via `role="status"`.
 *
 * Doesn't manage table state itself — the parent table is server-
 * rendered, so `router.refresh()` is the canonical way to re-render
 * after a mutation.
 */
export function RowActionButton({
  href,
  method,
  label,
  confirmMessage,
  body,
  tone = 'default',
  failureMessage,
}: RowActionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (confirmMessage && typeof window !== 'undefined') {
      if (!window.confirm(confirmMessage)) return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(href, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          setError(failureMessage);
          return;
        }
        router.refresh();
      } catch {
        setError(failureMessage);
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={cn(
          'inline-flex items-center justify-center border px-2.5 py-1 text-[0.7rem] font-medium tracking-wide whitespace-nowrap transition-colors disabled:opacity-50',
          tone === 'destructive'
            ? 'border-[#b00020]/40 text-[#7d1c1c] hover:bg-[#fceaea] hover:text-[#7d1c1c]'
            : 'text-charcoal-muted border-outline-variant hover:bg-canvas-sunken hover:text-charcoal',
        )}
      >
        {label}
      </button>
      {error ? (
        <span role="status" className="text-[0.65rem] leading-tight text-[#7d1c1c]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
