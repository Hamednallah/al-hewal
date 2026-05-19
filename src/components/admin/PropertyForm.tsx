'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { ADMIN_PROPERTY_STATUSES, ADMIN_PROPERTY_TYPES } from '@/lib/validators/property';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Single-page property create / edit form.
 *
 * PR 3.4 keeps this as one flat surface rather than the master plan's
 * 3-step wizard chrome — the wizard ceremony, draft autosave, images
 * (PR 3.5), and amenities step are queued as follow-ups. This first
 * cut covers every text + numeric field needed to create a publishable
 * property row, plus the publish-status toggle.
 *
 * Validation mirrors `src/lib/validators/property.ts`. The server
 * re-validates on every POST/PATCH (defence in depth), so the client
 * form's job is fast inline feedback, not security.
 */

const FormSchema = z.object({
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9]*(?:-[a-z0-9]+)*$/, 'lowercase letters, digits, and hyphens only')
    .or(z.literal(''))
    .optional(),
  title_ar: z.string().trim().min(1).max(200),
  title_en: z.string().trim().min(1).max(200),
  description_ar: z.string().trim().min(1).max(8000),
  description_en: z.string().trim().min(1).max(8000),
  type: z.enum(ADMIN_PROPERTY_TYPES),
  status: z.enum(ADMIN_PROPERTY_STATUSES),
  price_sar: z.coerce.number().int().nonnegative().max(1_000_000_000),
  price_negotiable: z.boolean().default(false),
  area_sqm: z.coerce.number().int().positive().max(1_000_000),
  bedrooms: z.coerce.number().int().nonnegative().max(50),
  bathrooms: z.coerce.number().int().nonnegative().max(50),
  city: z.string().trim().min(1).max(100),
  district: z.string().trim().max(100).optional(),
  plot_number: z.string().trim().max(50).optional(),
  street_width_m: z.union([z.coerce.number().nonnegative().max(500), z.literal('')]).optional(),
  facade: z.string().trim().max(50).optional(),
  lat: z.union([z.coerce.number().min(-90).max(90), z.literal('')]).optional(),
  lng: z.union([z.coerce.number().min(-180).max(180), z.literal('')]).optional(),
  google_maps_url: z.string().trim().max(500).url().or(z.literal('')).optional(),
  featured: z.boolean().default(false),
});

type FormValues = z.input<typeof FormSchema>;
type FormOutput = z.output<typeof FormSchema>;

interface PropertyFormProps {
  locale: Locale;
  mode: 'create' | 'edit';
  /** Existing property id when editing; undefined when creating. */
  propertyId?: string;
  /** Pre-populated values when editing. */
  initialValues?: Partial<FormValues>;
  /**
   * Server-rendered content for the Images section (grid + uploader).
   * The page builds it because the grid is a Server Component and the
   * form itself is a Client Component; passing as a slot lets us keep
   * the grid out of the client bundle. `undefined` (create mode)
   * surfaces the "save the draft first" hint instead.
   */
  imagesSlot?: React.ReactNode;
}

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; slug: string }
  | { kind: 'error'; code: string };

const EMPTY_DEFAULTS: FormValues = {
  slug: '',
  title_ar: '',
  title_en: '',
  description_ar: '',
  description_en: '',
  type: 'villa',
  status: 'draft',
  price_sar: 0,
  price_negotiable: false,
  area_sqm: 0,
  bedrooms: 0,
  bathrooms: 0,
  city: '',
  district: '',
  plot_number: '',
  street_width_m: '',
  facade: '',
  lat: '',
  lng: '',
  google_maps_url: '',
  featured: false,
};

export function PropertyForm({
  locale,
  mode,
  propertyId,
  initialValues,
  imagesSlot,
}: PropertyFormProps) {
  const t = useTranslations('admin.properties.form');
  const tFields = useTranslations('admin.properties.form.fields');
  const tType = useTranslations('admin.properties.type');
  const tStatus = useTranslations('admin.properties.status');
  const tErrors = useTranslations('admin.properties.form.errors');
  const tImages = useTranslations('admin.properties.images');
  const router = useRouter();
  const [status, setStatus] = useState<SubmitStatus>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(FormSchema),
    defaultValues: { ...EMPTY_DEFAULTS, ...initialValues },
  });

  const onSubmit = handleSubmit(async (data) => {
    setStatus({ kind: 'submitting' });
    try {
      // Strip empty strings on optional fields so the server interprets
      // "leave alone" rather than "set to NULL" on edit. Also drop
      // `featured` from edit-mode payloads when it matches the loaded
      // value — RHF always carries the checkbox state, and sending an
      // unchanged `featured` would trip the PATCH endpoint's super_admin
      // tier guard for routine standard_admin edits.
      const payload = Object.fromEntries(
        Object.entries(data).filter(([key, value]) => {
          if (value === '') return false;
          if (
            mode === 'edit' &&
            key === 'featured' &&
            initialValues !== undefined &&
            initialValues.featured === value
          ) {
            return false;
          }
          return true;
        }),
      );
      const url = mode === 'create' ? '/api/properties' : `/api/properties/${propertyId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // On CREATE, land the admin on the edit page for the new row so
        // they can immediately add images / publish, rather than bouncing
        // back to the listings and having to find the row again. On
        // EDIT, return to the listings (same as before — admin just
        // finished their changes).
        if (mode === 'create') {
          const body = (await res.json().catch(() => ({}))) as {
            data?: { id?: string };
          };
          const newId = body.data?.id;
          if (newId) {
            router.push(`/${locale}/admin/properties/${newId}/edit`);
            return;
          }
        }
        router.push(`/${locale}/admin/properties`);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus({ kind: 'error', code: body.error ?? 'unknown' });
    } catch {
      setStatus({ kind: 'error', code: 'network_error' });
    }
  });

  const submitting = status.kind === 'submitting';
  const errorCode = status.kind === 'error' ? status.code : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8 p-6 md:p-10">
      {errorCode ? (
        <p
          role="alert"
          data-testid="property-form-error"
          className="border-s-4 border-[#b00020] bg-[#fceaea] p-3 text-sm leading-relaxed text-[#7d1c1c]"
        >
          {tErrors(errorCode as never)}
        </p>
      ) : null}

      <Section title={t('sectionIdentity')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id="prop-title-ar"
            label={tFields('title_ar')}
            required
            error={errors.title_ar?.message}
            dir="rtl"
            {...register('title_ar')}
          />
          <Field
            id="prop-title-en"
            label={tFields('title_en')}
            required
            error={errors.title_en?.message}
            dir="ltr"
            {...register('title_en')}
          />
          <Field
            id="prop-slug"
            label={tFields('slug')}
            placeholder={tFields('slugPlaceholder')}
            error={errors.slug?.message}
            dir="ltr"
            className="md:col-span-2"
            {...register('slug')}
          />
        </div>
      </Section>

      <Section title={t('sectionDescription')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Textarea
            id="prop-desc-ar"
            label={tFields('description_ar')}
            required
            rows={6}
            error={errors.description_ar?.message}
            dir="rtl"
            {...register('description_ar')}
          />
          <Textarea
            id="prop-desc-en"
            label={tFields('description_en')}
            required
            rows={6}
            error={errors.description_en?.message}
            dir="ltr"
            {...register('description_en')}
          />
        </div>
      </Section>

      <Section title={t('sectionClassification')}>
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            id="prop-type"
            label={tFields('type')}
            options={ADMIN_PROPERTY_TYPES.map((value) => ({ value, label: tType(value) }))}
            error={errors.type?.message}
            {...register('type')}
          />
          <Select
            id="prop-status"
            label={tFields('status')}
            options={ADMIN_PROPERTY_STATUSES.map((value) => ({ value, label: tStatus(value) }))}
            error={errors.status?.message}
            {...register('status')}
          />
          <label className="text-charcoal flex items-end gap-2 pb-2 text-sm font-medium">
            <input
              type="checkbox"
              className="accent-teal-forest-700 h-4 w-4"
              {...register('featured')}
            />
            {tFields('featured')}
          </label>
        </div>
      </Section>

      <Section title={t('sectionPricing')}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            id="prop-price"
            label={tFields('price_sar')}
            type="number"
            inputMode="numeric"
            required
            min={0}
            error={errors.price_sar?.message}
            dir="ltr"
            {...register('price_sar')}
          />
          <label className="text-charcoal flex items-end gap-2 pb-2 text-sm font-medium">
            <input
              type="checkbox"
              className="accent-teal-forest-700 h-4 w-4"
              {...register('price_negotiable')}
            />
            {tFields('price_negotiable')}
          </label>
        </div>
      </Section>

      <Section title={t('sectionSpecs')}>
        <div className="grid gap-4 md:grid-cols-4">
          <Field
            id="prop-area"
            label={tFields('area_sqm')}
            type="number"
            inputMode="numeric"
            required
            min={1}
            error={errors.area_sqm?.message}
            dir="ltr"
            {...register('area_sqm')}
          />
          <Field
            id="prop-bedrooms"
            label={tFields('bedrooms')}
            type="number"
            inputMode="numeric"
            required
            min={0}
            error={errors.bedrooms?.message}
            dir="ltr"
            {...register('bedrooms')}
          />
          <Field
            id="prop-bathrooms"
            label={tFields('bathrooms')}
            type="number"
            inputMode="numeric"
            required
            min={0}
            error={errors.bathrooms?.message}
            dir="ltr"
            {...register('bathrooms')}
          />
          <Field
            id="prop-street-width"
            label={tFields('street_width_m')}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            error={errors.street_width_m?.message}
            dir="ltr"
            {...register('street_width_m')}
          />
        </div>
      </Section>

      <Section title={t('sectionLocation')}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            id="prop-city"
            label={tFields('city')}
            required
            error={errors.city?.message}
            {...register('city')}
          />
          <Field
            id="prop-district"
            label={tFields('district')}
            error={errors.district?.message}
            {...register('district')}
          />
          <Field
            id="prop-plot"
            label={tFields('plot_number')}
            error={errors.plot_number?.message}
            dir="ltr"
            {...register('plot_number')}
          />
          <Field
            id="prop-facade"
            label={tFields('facade')}
            placeholder={tFields('facadePlaceholder')}
            error={errors.facade?.message}
            {...register('facade')}
          />
          <Field
            id="prop-lat"
            label={tFields('lat')}
            type="number"
            inputMode="decimal"
            step="any"
            error={errors.lat?.message}
            dir="ltr"
            {...register('lat')}
          />
          <Field
            id="prop-lng"
            label={tFields('lng')}
            type="number"
            inputMode="decimal"
            step="any"
            error={errors.lng?.message}
            dir="ltr"
            {...register('lng')}
          />
          <Field
            id="prop-maps-url"
            label={tFields('google_maps_url')}
            type="url"
            placeholder={tFields('google_maps_url_placeholder')}
            error={errors.google_maps_url?.message}
            dir="ltr"
            className="md:col-span-3"
            {...register('google_maps_url')}
          />
        </div>
      </Section>

      <Section title={t('sectionImages')}>
        {mode === 'edit' && propertyId ? (
          imagesSlot
        ) : (
          <p
            data-testid="property-images-create-hint"
            className="text-charcoal-muted bg-canvas-sunken/30 border-outline-variant/30 border p-4 text-sm leading-relaxed"
          >
            {tImages('createModeHint')}
          </p>
        )}
      </Section>

      <div className="border-outline-variant/40 flex items-center justify-end gap-3 border-t pt-6">
        <Button type="submit" variant="primary" size="md" disabled={submitting}>
          {submitting ? t('submitting') : mode === 'create' ? t('submitCreate') : t('submitUpdate')}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-teal-forest-700 text-base font-semibold tracking-[0.18em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

type FieldBaseProps = { id: string; label: string; error?: string; className?: string };
type FieldProps = FieldBaseProps & React.InputHTMLAttributes<HTMLInputElement>;

function Field({ id, label, error, required, className, ...inputProps }: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-charcoal text-sm font-semibold">
        {label}
        {required ? <span className="text-brass-700 ms-1">*</span> : null}
      </label>
      <input
        {...inputProps}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'bg-canvas border-outline-variant text-charcoal focus:border-teal-forest-500 border-b px-1 py-2 text-base focus:outline-none',
          error && 'border-[#b00020]',
        )}
      />
      {error ? (
        <p id={errorId} className="text-xs leading-relaxed text-[#7d1c1c]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextareaProps = FieldBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

function Textarea({ id, label, error, required, className, ...areaProps }: TextareaProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-charcoal text-sm font-semibold">
        {label}
        {required ? <span className="text-brass-700 ms-1">*</span> : null}
      </label>
      <textarea
        {...areaProps}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'bg-canvas border-outline-variant text-charcoal focus:border-teal-forest-500 border px-3 py-2 text-base focus:outline-none',
          error && 'border-[#b00020]',
        )}
      />
      {error ? (
        <p id={errorId} className="text-xs leading-relaxed text-[#7d1c1c]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SelectOption = { value: string; label: string };
type SelectProps = FieldBaseProps & {
  options: SelectOption[];
} & React.SelectHTMLAttributes<HTMLSelectElement>;

function Select({ id, label, error, options, className, ...selectProps }: SelectProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-charcoal text-sm font-semibold">
        {label}
      </label>
      <select
        {...selectProps}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'bg-canvas border-outline-variant text-charcoal focus:border-teal-forest-500 border-b px-1 py-2 text-base focus:outline-none',
          error && 'border-[#b00020]',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="text-xs leading-relaxed text-[#7d1c1c]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
