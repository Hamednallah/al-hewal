'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { ADMIN_TIERS } from '@/lib/validators/admin';

/**
 * Invite-new-admin form (PR phase-3-admin-management-ui).
 *
 * Mirrors the PropertyForm convention: react-hook-form + Zod resolver,
 * minimal styling (sharp 0px corners per design tokens), inline errors
 * keyed off `formState.errors`, server errors surfaced in a top alert
 * with translated error-code keys.
 *
 * The server (`POST /api/admins`) is the authoritative validator; this
 * form's Zod schema is a UX-side mirror of it.
 */

const FormSchema = z.object({
  email: z.string().trim().email().min(3).max(320),
  full_name: z.string().trim().min(1).max(200),
  tier: z.enum(ADMIN_TIERS),
  language_pref: z.enum(['ar', 'en']).default('en'),
});

type FormValues = z.input<typeof FormSchema>;
type FormOutput = z.output<typeof FormSchema>;

const DEFAULTS: FormValues = {
  email: '',
  full_name: '',
  tier: 'standard_admin',
  language_pref: 'en',
};

interface InviteAdminFormProps {
  locale: Locale;
}

type SubmitStatus = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'error'; code: string };

export function InviteAdminForm({ locale }: InviteAdminFormProps) {
  const t = useTranslations('admin.admins.invite');
  const tFields = useTranslations('admin.admins.invite.fields');
  const tTier = useTranslations('admin.admins.tier');
  const tErrors = useTranslations('admin.admins.invite.errors');
  const router = useRouter();
  const [status, setStatus] = useState<SubmitStatus>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(FormSchema),
    defaultValues: DEFAULTS,
  });

  const onSubmit = handleSubmit(async (data) => {
    setStatus({ kind: 'submitting' });
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        router.push(`/${locale}/admin/admins`);
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 p-6 md:p-10">
      {errorCode ? (
        <p
          role="alert"
          data-testid="invite-form-error"
          className="border-s-4 border-[#b00020] bg-[#fceaea] p-3 text-sm leading-relaxed text-[#7d1c1c]"
        >
          {tErrors(errorCode as never)}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          id="admin-email"
          label={tFields('email')}
          required
          type="email"
          autoComplete="off"
          dir="ltr"
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          id="admin-full-name"
          label={tFields('full_name')}
          required
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <Select
          id="admin-tier"
          label={tFields('tier')}
          required
          options={ADMIN_TIERS.map((value) => ({ value, label: tTier(value) }))}
          error={errors.tier?.message}
          {...register('tier')}
        />
        <Select
          id="admin-language-pref"
          label={tFields('language_pref')}
          required
          options={[
            { value: 'en', label: tFields('language_en') },
            { value: 'ar', label: tFields('language_ar') },
          ]}
          error={errors.language_pref?.message}
          {...register('language_pref')}
        />
      </div>

      <p className="text-charcoal-muted text-xs leading-relaxed">{t('hint')}</p>

      <div className="border-outline-variant/40 flex items-center justify-end gap-3 border-t pt-6">
        <Button type="submit" variant="primary" size="md" disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
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

type SelectOption = { value: string; label: string };
type SelectProps = FieldBaseProps & {
  options: SelectOption[];
} & React.SelectHTMLAttributes<HTMLSelectElement>;

function Select({ id, label, error, options, required, className, ...selectProps }: SelectProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-charcoal text-sm font-semibold">
        {label}
        {required ? <span className="text-brass-700 ms-1">*</span> : null}
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
