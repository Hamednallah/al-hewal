'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { requestMagicLink, type LoginErrorKey, type LoginState } from './actions';

const INITIAL_STATE: LoginState = { status: 'idle' };

interface LoginFormProps {
  next?: string;
  initialError?: LoginErrorKey | 'notAdmin' | 'callbackInvalid' | 'callbackExpired';
}

export default function LoginForm({ next, initialError }: LoginFormProps) {
  const t = useTranslations('admin.auth.login');
  const [state, action, isPending] = useActionState(requestMagicLink, INITIAL_STATE);
  const [dismissedInitialError, setDismissedInitialError] = useState(false);

  if (state.status === 'sent') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-canvas text-2xl font-medium">{t('sentTitle')}</h1>
        <p className="text-canvas/80">{t('sentBody', { email: state.email })}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-brass underline-offset-4 hover:underline"
        >
          {t('tryAnother')}
        </button>
      </div>
    );
  }

  const showInitialError = initialError && !dismissedInitialError && state.status !== 'error';

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2 text-center">
        <h1 className="text-canvas text-2xl font-medium">{t('title')}</h1>
        <p className="text-canvas/80">{t('intro')}</p>
      </div>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-2">
        <label htmlFor="email" className="text-canvas block text-sm font-medium">
          {t('emailLabel')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={t('emailPlaceholder')}
          dir="ltr"
          className="border-canvas/30 text-canvas placeholder:text-canvas/40 focus:border-brass block w-full border bg-transparent px-4 py-3 focus:outline-none"
          onChange={() => setDismissedInitialError(true)}
        />
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-red-300">
          {t(`errors.${state.errorKey}`)}
        </p>
      ) : null}

      {showInitialError ? (
        <p role="alert" className="text-sm text-red-300">
          {t(`errors.${initialError}`)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="bg-brass text-teal-forest hover:bg-brass/90 block w-full px-4 py-3 disabled:opacity-60"
      >
        {isPending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
