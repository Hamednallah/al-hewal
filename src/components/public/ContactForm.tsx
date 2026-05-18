'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Client-side contact form. Submits to `/api/leads` (POST).
 *
 * Validation mirrors the route's Zod schema in
 * `src/app/api/leads/route.ts` — same required min/max bounds for
 * name + phone, email + message both optional. The server still
 * re-validates (defence in depth + phone normalisation via
 * libphonenumber-js).
 *
 * Submit states render bilingually via next-intl: idle / submitting /
 * success / error. Errors surface both inline (per field) AND at the
 * top of the form as a status region the screen reader picks up.
 */

const FormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  message: z.string().trim().max(4000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof FormSchema>;

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; code: ErrorCode };

type ErrorCode =
  | 'invalid_phone'
  | 'invalid_body'
  | 'rate_limited'
  | 'server_error'
  | 'network_error';

type ContactFormProps = {
  locale: Locale;
};

export function ContactForm({ locale }: ContactFormProps) {
  const t = useTranslations('public.contact');
  const tFields = useTranslations('public.contact.fields');
  const tErrors = useTranslations('public.contact.errors');
  const [status, setStatus] = useState<SubmitStatus>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '', phone: '', email: '', message: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setStatus({ kind: 'submitting' });
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email || undefined,
          message: data.message || undefined,
          locale,
        }),
      });
      if (res.ok) {
        setStatus({ kind: 'success' });
        reset();
        return;
      }
      type Body = { error?: ErrorCode };
      const body = (await res.json().catch(() => ({}))) as Body;
      const code = body.error ?? 'server_error';
      setStatus({ kind: 'error', code });
    } catch {
      setStatus({ kind: 'error', code: 'network_error' });
    }
  });

  if (status.kind === 'success') {
    return (
      <div
        role="status"
        className="bg-teal-forest-700 text-canvas border-brass-400 border-t-4 p-8 md:p-10"
      >
        <p className="text-brass-400 text-xs tracking-[0.3em] uppercase">{t('successTitle')}</p>
        <p className="mt-3 text-lg leading-relaxed md:text-xl">{t('successBody')}</p>
      </div>
    );
  }

  const isSubmitting = status.kind === 'submitting';
  const topLevelError = status.kind === 'error' ? tErrors(status.code) : null;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="bg-canvas-raised border-outline-variant flex flex-col gap-6 border p-6 md:p-10"
    >
      <h2 className="text-teal-forest-700 text-2xl font-semibold leading-tight md:text-3xl">
        {t('formTitle')}
      </h2>

      {topLevelError ? (
        <p
          role="alert"
          className="border-[#b00020] bg-[#fceaea] text-[#7d1c1c] border-s-4 p-3 text-sm leading-relaxed"
        >
          {topLevelError}
        </p>
      ) : null}

      <Field
        id="contact-name"
        label={tFields('name')}
        placeholder={tFields('namePlaceholder')}
        required
        autoComplete="name"
        error={errors.name?.message}
        {...register('name')}
      />
      <Field
        id="contact-phone"
        label={tFields('phone')}
        placeholder={tFields('phonePlaceholder')}
        type="tel"
        required
        autoComplete="tel"
        inputMode="tel"
        dir="ltr"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <Field
        id="contact-email"
        label={tFields('email')}
        placeholder={tFields('emailPlaceholder')}
        type="email"
        autoComplete="email"
        dir="ltr"
        error={errors.email?.message}
        {...register('email')}
      />
      <FieldTextarea
        id="contact-message"
        label={tFields('message')}
        placeholder={tFields('messagePlaceholder')}
        rows={5}
        error={errors.message?.message}
        {...register('message')}
      />

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
          {isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}

type FieldBaseProps = {
  id: string;
  label: string;
  error?: string;
};

type FieldProps = FieldBaseProps & React.InputHTMLAttributes<HTMLInputElement>;

function Field({ id, label, error, ...inputProps }: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-charcoal text-sm font-semibold">
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'bg-canvas border-outline-variant text-charcoal focus-visible:border-teal-forest-500 focus-visible:ring-brass-400 border-b px-1 py-2 text-base outline-none focus-visible:ring-1',
          error && 'border-[#b00020]',
        )}
      />
      {error ? (
        <p id={errorId} className="text-[#7d1c1c] text-xs leading-relaxed">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FieldTextareaProps = FieldBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

function FieldTextarea({ id, label, error, ...textareaProps }: FieldTextareaProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-charcoal text-sm font-semibold">
        {label}
      </label>
      <textarea
        {...textareaProps}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'bg-canvas border-outline-variant text-charcoal focus-visible:border-teal-forest-500 focus-visible:ring-brass-400 border px-3 py-2 text-base outline-none focus-visible:ring-1',
          error && 'border-[#b00020]',
        )}
      />
      {error ? (
        <p id={errorId} className="text-[#7d1c1c] text-xs leading-relaxed">
          {error}
        </p>
      ) : null}
    </div>
  );
}
