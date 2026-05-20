'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import {
  changePassword,
  type ChangePasswordErrorKey,
  type ChangePasswordState,
} from '@/app/[locale]/admin/profile/actions';

// Map server-action error codes to i18n keys under `admin.profile.passwordForm`.
const ERROR_KEY_BY_CODE: Record<ChangePasswordErrorKey, string> = {
  invalidInput: 'errorGeneric',
  mismatch: 'errorMismatch',
  tooShort: 'errorTooShort',
  samePassword: 'errorSame',
  notAuthenticated: 'errorGeneric',
  supabase: 'errorGeneric',
};

const INITIAL: ChangePasswordState = { status: 'idle' };

/**
 * Client form bound to the `changePassword` server action. Two
 * password inputs (new + confirm). On success the form clears + shows
 * a brief flash. The Supabase session stays alive so the admin stays
 * signed in on the current device.
 */
export function ProfilePasswordForm() {
  const t = useTranslations('admin.profile.passwordForm');
  const [state, action, isPending] = useActionState(changePassword, INITIAL);

  return (
    <form
      action={action}
      data-testid="profile-password-form"
      className="bg-canvas-raised border-outline-variant/30 flex flex-col gap-4 border p-5 md:p-6"
    >
      <div>
        <h2 className="text-teal-forest-700 text-sm font-semibold tracking-[0.2em] uppercase">
          {t('heading')}
        </h2>
        <p className="text-charcoal-muted mt-2 text-sm">{t('intro')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-charcoal text-sm font-semibold" htmlFor="profile-password-new">
            {t('newLabel')}
          </label>
          <input
            id="profile-password-new"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            className="bg-canvas border-outline-variant focus:border-teal-forest-500 text-charcoal border-b px-1 py-2 text-base focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-charcoal text-sm font-semibold" htmlFor="profile-password-confirm">
            {t('confirmLabel')}
          </label>
          <input
            id="profile-password-confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            className="bg-canvas border-outline-variant focus:border-teal-forest-500 text-charcoal border-b px-1 py-2 text-base focus:outline-none"
          />
        </div>
      </div>

      {state.status === 'error' ? (
        <p
          role="alert"
          data-testid="profile-password-error"
          className="border-s-4 border-[#b00020] bg-[#fceaea] p-3 text-sm leading-relaxed text-[#7d1c1c]"
        >
          {t(ERROR_KEY_BY_CODE[state.errorKey])}
        </p>
      ) : null}

      {state.status === 'success' ? (
        <p
          role="status"
          data-testid="profile-password-success"
          className="border-teal-forest-700 border-s-4 bg-[#e8f1f1] p-3 text-sm leading-relaxed text-[#1f4747]"
        >
          {t('successFlash')}
        </p>
      ) : null}

      <div className="flex items-center justify-end">
        <Button type="submit" variant="primary" size="md" disabled={isPending}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
