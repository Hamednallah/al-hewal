'use client';

import { upload } from '@vercel/blob/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { validateUploadCandidate } from '@/lib/client-image-validation';
import { ACCEPTED_INPUT_MIME_TYPES, type AcceptedInputMimeType } from '@/lib/image-constants';
import { cn } from '@/lib/utils';

/**
 * Drag-and-drop image uploader for the admin property edit form
 * (PR 3.5b).
 *
 * Talks to Vercel Blob's client-upload helper (`@vercel/blob/client#upload`)
 * which:
 *   1. POSTs metadata to `/api/upload` (our route runs Phase 1 of
 *      `handleUpload` and returns a signed token).
 *   2. PUTs the file bytes directly from the browser to Vercel Blob.
 *   3. Pings `/api/upload` again so Phase 2 (sharp + DB insert) runs
 *      server-side. In production the webhook is delivered by Vercel
 *      Blob automatically; in `pnpm dev` it never reaches localhost
 *      (see docs/PHASE_3_RUNBOOK.md §6).
 *
 * Why only one file at a time: each upload needs distinct alt_ar/en
 * (a11y requirement on the public catalog). A multi-file batch form
 * with per-file alt inputs is queued for PR 3.5c. Today the form
 * captures one file + its alts, uploads, then router.refresh()es so
 * the parent server-rendered grid picks up the new row.
 */

interface PropertyImageUploaderProps {
  propertyId: string;
  /** Position to write on the new `property_images` row. */
  nextPosition: number;
}

type UiState =
  | { kind: 'idle' }
  | { kind: 'invalid'; message: string }
  | { kind: 'ready'; file: File; mime: AcceptedInputMimeType }
  | { kind: 'uploading'; file: File }
  | { kind: 'error'; message: string };

export function PropertyImageUploader({ propertyId, nextPosition }: PropertyImageUploaderProps) {
  const t = useTranslations('admin.properties.images');
  const router = useRouter();
  const inputId = useId();
  const altArId = useId();
  const altEnId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<UiState>({ kind: 'idle' });
  const [altAr, setAltAr] = useState('');
  const [altEn, setAltEn] = useState('');

  function chooseFile(file: File | null) {
    if (!file) return setState({ kind: 'idle' });
    const result = validateUploadCandidate({ type: file.type, size: file.size });
    if (!result.ok) {
      const message =
        result.error.code === 'unsupported_format'
          ? t('fileError_unsupported_format', { filename: file.name })
          : t('fileError_input_too_large', { filename: file.name });
      setState({ kind: 'invalid', message });
      return;
    }
    setState({ kind: 'ready', file, mime: result.mime });
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    chooseFile(e.target.files?.[0] ?? null);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    chooseFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function onUpload() {
    if (state.kind !== 'ready') return;
    if (!altAr.trim() || !altEn.trim()) {
      setState({ kind: 'error', message: t('altMissing') });
      return;
    }
    const file = state.file;
    const mime = state.mime;
    setState({ kind: 'uploading', file });
    try {
      await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        contentType: mime,
        clientPayload: JSON.stringify({
          propertyId,
          alt_ar: altAr.trim(),
          alt_en: altEn.trim(),
          position: nextPosition,
          filename: file.name,
          contentType: mime,
        }),
      });
      // Reset, then trigger the parent server component to re-fetch
      // the images list. The new row may not be in the DB yet (the
      // webhook is async); router.refresh() also re-runs whenever
      // the admin returns to the form, so we accept the small race.
      setAltAr('');
      setAltEn('');
      setState({ kind: 'idle' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn('[PropertyImageUploader] upload failed:', detail);
      setState({ kind: 'error', message: t('uploadError', { filename: file.name }) });
    }
  }

  const uploading = state.kind === 'uploading';
  const canUpload = state.kind === 'ready' && altAr.trim().length > 0 && altEn.trim().length > 0;
  const errorMessage =
    state.kind === 'invalid' ? state.message : state.kind === 'error' ? state.message : null;

  return (
    <div className="space-y-4">
      <p className="text-charcoal-muted text-sm leading-relaxed">{t('sectionDescription')}</p>

      <label
        htmlFor={inputId}
        data-testid="property-image-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'border-outline-variant bg-canvas hover:bg-canvas-sunken/30 flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed p-8 text-center transition-colors',
          dragOver && 'border-teal-forest-500 bg-canvas-sunken/40',
        )}
      >
        <span className="text-charcoal text-sm font-medium">
          {dragOver ? t('dropzoneActive') : t('dropzoneIdle')}
        </span>
        {state.kind === 'ready' || state.kind === 'uploading' ? (
          <span className="text-charcoal-muted text-xs">{state.file.name}</span>
        ) : null}
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_INPUT_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={onPick}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={altArId} className="text-charcoal text-xs font-semibold">
            {t('altArLabel')}
          </label>
          <input
            id={altArId}
            type="text"
            value={altAr}
            onChange={(e) => setAltAr(e.target.value)}
            placeholder={t('altPlaceholder')}
            dir="rtl"
            maxLength={500}
            className="bg-canvas border-outline-variant focus:border-teal-forest-500 border-b px-1 py-2 text-base focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={altEnId} className="text-charcoal text-xs font-semibold">
            {t('altEnLabel')}
          </label>
          <input
            id={altEnId}
            type="text"
            value={altEn}
            onChange={(e) => setAltEn(e.target.value)}
            placeholder={t('altPlaceholder')}
            dir="ltr"
            maxLength={500}
            className="bg-canvas border-outline-variant focus:border-teal-forest-500 border-b px-1 py-2 text-base focus:outline-none"
          />
        </div>
      </div>

      {errorMessage ? (
        <p role="status" className="text-sm leading-relaxed text-[#7d1c1c]">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!canUpload || uploading}
          onClick={onUpload}
        >
          {uploading ? t('uploadingButton') : t('uploadButton', { count: 1 })}
        </Button>
      </div>
    </div>
  );
}
