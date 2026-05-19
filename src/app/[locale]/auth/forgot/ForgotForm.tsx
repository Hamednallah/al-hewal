'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import { requestPasswordReset, type ForgotState } from './actions';

const INITIAL_STATE: ForgotState = { status: 'idle' };

interface ForgotFormProps {
  locale: Locale;
}

export default function ForgotForm({ locale }: ForgotFormProps) {
  const t = useTranslations('admin.auth.forgot');
  const [state, action, isPending] = useActionState(requestPasswordReset, INITIAL_STATE);
  const [dismissed, setDismissed] = useState(false);

  if (state.status === 'sent') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-canvas text-2xl font-medium">{t('sentTitle')}</h1>
        <p className="text-canvas/80">{t('sentBody', { email: state.email })}</p>
        <p>
          <Link href="/auth/login" className="text-brass underline-offset-4 hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2 text-center">
        <h1 className="text-canvas text-2xl font-medium">{t('title')}</h1>
        <p className="text-canvas/80">{t('intro')}</p>
      </div>

      {/* Locale is set on the redirect URL Supabase will send via email,
          so the post-reset page matches the language the admin requested
          the reset in. */}
      <input type="hidden" name="locale" value={locale} />

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
          onChange={() => setDismissed(true)}
        />
      </div>

      {state.status === 'error' && !dismissed ? (
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
