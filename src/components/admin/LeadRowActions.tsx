'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { cn } from '@/lib/utils';

interface LeadRowActionsProps {
  leadId: string;
  phone: string | null;
  initialContactedAt: string | null;
  initialNotes: string | null;
}

/**
 * Per-row controls for one lead (PR 3.6).
 *
 *   - "Copy phone" writes the phone to the clipboard and shows a
 *     transient "Copied" affordance for 1.5s. Disabled when phone is
 *     null (some leads come in without one).
 *   - "Open WhatsApp" opens wa.me with the lead's phone. We DO NOT
 *     prefill a message — leaving the agent to write the actual
 *     greeting is the right product behaviour.
 *   - Toggle contacted / pending — PATCHes the lead row.
 *   - Inline notes editor (textarea + Save/Cancel). PATCH on save.
 *
 * State is optimistic; failures restore the previous value and surface
 * an inline error.
 */
export function LeadRowActions({
  leadId,
  phone,
  initialContactedAt,
  initialNotes,
}: LeadRowActionsProps) {
  const t = useTranslations('admin.leads.actions');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contactedAt, setContactedAt] = useState<string | null>(initialContactedAt);
  const [notes, setNotes] = useState<string | null>(initialNotes);
  const [editing, setEditing] = useState(false);
  const [draftNotes, setDraftNotes] = useState<string>(initialNotes ?? '');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyPhone() {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t('patchFailed'));
    }
  }

  function patch(body: { contacted?: boolean; notes?: string | null }) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setError(t('patchFailed'));
          return;
        }
        const json = (await res.json()) as {
          data?: { contacted_at?: string | null; notes?: string | null };
        };
        if (json.data) {
          if ('contacted_at' in json.data) setContactedAt(json.data.contacted_at ?? null);
          if ('notes' in json.data) {
            setNotes(json.data.notes ?? null);
            setDraftNotes(json.data.notes ?? '');
          }
        }
        router.refresh();
      } catch {
        setError(t('patchFailed'));
      }
    });
  }

  const isContacted = contactedAt !== null;
  const waHref = phone ? `https://wa.me/${phone.replace(/^\+/, '')}` : null;

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={copyPhone}
          disabled={!phone}
          className="border-outline-variant/50 text-charcoal hover:bg-canvas-sunken/50 border px-2 py-1 disabled:opacity-40"
        >
          {copied ? t('copied') : t('copyPhone')}
        </button>
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="border-brass/40 text-brass hover:bg-brass/10 border px-2 py-1"
          >
            {t('openWhatsapp')}
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => patch({ contacted: !isContacted })}
          disabled={pending}
          className={cn(
            'border px-2 py-1 disabled:opacity-50',
            isContacted
              ? 'border-outline-variant/50 text-charcoal-muted hover:bg-canvas-sunken/50'
              : 'border-teal-forest-700/60 text-teal-forest-700 hover:bg-teal-forest-700/10',
          )}
        >
          {pending ? t('saving') : isContacted ? t('markPending') : t('markContacted')}
        </button>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="border-outline-variant/50 text-charcoal hover:bg-canvas-sunken/50 border px-2 py-1"
          >
            {t('editNotes')}
          </button>
        ) : null}
      </div>
      {notes && !editing ? (
        <p className="text-charcoal-muted text-[0.7rem] leading-relaxed whitespace-pre-wrap">
          {notes}
        </p>
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            maxLength={2000}
            rows={3}
            className="bg-canvas border-outline-variant focus:border-teal-forest-500 border px-2 py-1 text-[0.7rem] focus:outline-none"
          />
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const trimmed = draftNotes.trim();
                patch({ notes: trimmed === '' ? null : trimmed });
                setEditing(false);
              }}
              className="border-teal-forest-700/60 text-teal-forest-700 hover:bg-teal-forest-700/10 border px-2 py-1 disabled:opacity-50"
            >
              {pending ? t('saving') : t('saveNotes')}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftNotes(notes ?? '');
                setEditing(false);
              }}
              className="border-outline-variant/50 text-charcoal-muted hover:bg-canvas-sunken/50 border px-2 py-1"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="status" className="text-[0.65rem] text-[#7d1c1c]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
