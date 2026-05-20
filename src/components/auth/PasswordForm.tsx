'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import { setNewPassword, type ResetState } from '@/app/[locale]/auth/reset-password/actions';

/**
 * Shared password-set form used by both the invite-acceptance page
 * (`/<locale>/auth/set-password`) and the password-recovery page
 * (`/<locale>/auth/reset-password`).
 *
 * The two flows share the same Supabase plumbing (`exchangeCodeForSession`
 * runs in `/auth/recovery`, then this form calls
 * `supabase.auth.updateUser({password})` via the `setNewPassword`
 * server action), but the UX intent is opposite:
 *
 *   - `invite`: new admin onboarding. Welcoming tone, "set your
 *     password for the first time".
 *   - `reset` : existing admin lost their password. Recovery tone,
 *     "pick a new password".
 *
 * The `namespace` prop drives which i18n bundle to read from:
 *
 *   - `admin.auth.setPassword` for the invite flow
 *   - `admin.auth.reset`       for the recovery flow
 *
 * Both bundles MUST expose the same key shape (title, intro,
 * passwordLabel, confirmLabel, submit, submitting, backToLogin,
 * errors.{invalidInput,mismatch,expiredSession,notAdmin,samePassword,
 * supabase}).
 */

const INITIAL_STATE: ResetState = { status: 'idle' };

export type PasswordFormNamespace = 'admin.auth.setPassword' | 'admin.auth.reset';

interface PasswordFormProps {
  locale: Locale;
  namespace: PasswordFormNamespace;
}

export default function PasswordForm({ locale, namespace }: PasswordFormProps) {
  const t = useTranslations(namespace);
  const [state, action, isPending] = useActionState(setNewPassword, INITIAL_STATE);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2 text-center">
        <h1 className="text-canvas text-2xl font-medium">{t('title')}</h1>
        <p className="text-canvas/80">{t('intro')}</p>
      </div>

      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-2">
        <label htmlFor="password" className="text-canvas block text-sm font-medium">
          {t('passwordLabel')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          dir="ltr"
          className="border-canvas/30 text-canvas placeholder:text-canvas/40 focus:border-brass block w-full border bg-transparent px-4 py-3 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm" className="text-canvas block text-sm font-medium">
          {t('confirmLabel')}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          dir="ltr"
          className="border-canvas/30 text-canvas placeholder:text-canvas/40 focus:border-brass block w-full border bg-transparent px-4 py-3 focus:outline-none"
        />
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-red-300">
          {t(`errors.${state.errorKey}`)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="bg-brass text-teal-forest hover:bg-brass/90 block w-full px-4 py-3 disabled:opacity-60"
      >
        {isPending ? t('submitting') : t('submit')}
      </button>

      <p className="text-canvas/70 text-center text-sm">
        <Link href="/auth/login" className="text-brass underline-offset-4 hover:underline">
          {t('backToLogin')}
        </Link>
      </p>
    </form>
  );
}
