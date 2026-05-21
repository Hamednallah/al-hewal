'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import {
  changeEmail,
  type ChangeEmailErrorKey,
  type ChangeEmailState,
} from '@/app/[locale]/admin/profile/actions';

// Map server-action error codes to i18n keys under `admin.profile.emailForm`.
const ERROR_KEY_BY_CODE: Record<ChangeEmailErrorKey, string> = {
  invalidInput: 'errorInvalid',
  sameEmail: 'errorSame',
  rateLimited: 'errorRateLimited',
  notAuthenticated: 'errorGeneric',
  supabase: 'errorGeneric',
};

interface ProfileEmailFormProps {
  currentEmail: string;
}

const INITIAL: ChangeEmailState = { status: 'idle' };

/**
 * Client form bound to the `changeEmail` server action. The current
 * email is shown read-only above the editable "new email" input so
 * the admin can compare. On success the form surfaces the
 * "check your new inbox" message; sign-in only switches when the
 * Supabase confirmation link is clicked.
 */
export function ProfileEmailForm({ currentEmail }: ProfileEmailFormProps) {
  const t = useTranslations('admin.profile.emailForm');
  const [state, action, isPending] = useActionState(changeEmail, INITIAL);

  return (
    <form
      action={action}
      data-testid="profile-email-form"
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
          <label className="text-charcoal text-sm font-semibold" htmlFor="profile-email-current">
            {t('currentLabel')}
          </label>
          <input
            id="profile-email-current"
            type="email"
            value={currentEmail}
            readOnly
            dir="ltr"
            className="bg-canvas border-outline-variant text-charcoal-muted border-b px-1 py-2 text-base"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-charcoal text-sm font-semibold" htmlFor="profile-email-new">
            {t('newLabel')}
          </label>
          <input
            id="profile-email-new"
            name="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            className="bg-canvas border-outline-variant focus:border-teal-forest-500 text-charcoal border-b px-1 py-2 text-base focus:outline-none"
          />
        </div>
      </div>

      {state.status === 'error' ? (
        <p
          role="alert"
          data-testid="profile-email-error"
          className="border-s-4 border-[#b00020] bg-[#fceaea] p-3 text-sm leading-relaxed text-[#7d1c1c]"
        >
          {t(ERROR_KEY_BY_CODE[state.errorKey])}
        </p>
      ) : null}

      {state.status === 'success' ? (
        <p
          role="status"
          data-testid="profile-email-success"
          className="border-teal-forest-700 border-s-4 bg-[#e8f1f1] p-3 text-sm leading-relaxed text-[#1f4747]"
        >
          {t('successPending')}
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
