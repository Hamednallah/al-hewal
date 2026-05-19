'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import { setNewPassword, type ResetState } from './actions';

const INITIAL_STATE: ResetState = { status: 'idle' };

interface ResetPasswordFormProps {
  locale: Locale;
}

export default function ResetPasswordForm({ locale }: ResetPasswordFormProps) {
  const t = useTranslations('admin.auth.reset');
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
