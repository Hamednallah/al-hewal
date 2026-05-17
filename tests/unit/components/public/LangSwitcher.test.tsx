import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { LangSwitcher } from '@/components/public/LangSwitcher';

// next-intl's locale-aware Link + usePathname both rely on the routing
// config + the active locale from context. Mock the navigation module so
// we control the pathname value across tests and can assert the href
// the switcher actually generates.
vi.mock('@/i18n/navigation', () => {
  const path = '/properties/al-dana-21';
  return {
    usePathname: () => path,
    // Simple Link that surfaces the href + locale props on a plain <a>.
    Link: ({
      href,
      locale,
      children,
      ...rest
    }: {
      href: string;
      locale?: string;
      children: React.ReactNode;
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a href={locale ? `/${locale}${href}` : href} data-locale={locale} {...rest}>
        {children}
      </a>
    ),
  };
});

const messages = {
  public: {
    common: {
      languageSwitch: 'English',
    },
  },
};

const arMessages = {
  public: {
    common: {
      languageSwitch: 'English',
    },
  },
};

const enMessages = {
  public: {
    common: {
      languageSwitch: 'العربية',
    },
  },
};

describe('LangSwitcher', () => {
  it('on AR shows the English label and links to the EN copy of the current path', () => {
    render(
      <NextIntlClientProvider locale="ar" messages={arMessages}>
        <LangSwitcher />
      </NextIntlClientProvider>,
    );
    const link = screen.getByRole('link', { name: 'English' });
    expect(link.getAttribute('href')).toBe('/en/properties/al-dana-21');
    expect(link.getAttribute('data-locale')).toBe('en');
    expect(link.getAttribute('hrefLang')).toBe('en');
  });

  it('on EN shows the Arabic label and links to the AR copy of the current path', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <LangSwitcher />
      </NextIntlClientProvider>,
    );
    const link = screen.getByRole('link', { name: 'العربية' });
    expect(link.getAttribute('href')).toBe('/ar/properties/al-dana-21');
    expect(link.getAttribute('data-locale')).toBe('ar');
    expect(link.getAttribute('hrefLang')).toBe('ar');
  });

  it('exposes an aria-label so screen readers announce the destination locale', () => {
    render(
      <NextIntlClientProvider locale="ar" messages={messages}>
        <LangSwitcher />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('link').getAttribute('aria-label')).toBe('English');
  });

  it('merges user-supplied className without losing the styled defaults', () => {
    render(
      <NextIntlClientProvider locale="ar" messages={messages}>
        <LangSwitcher className="hidden md:block" />
      </NextIntlClientProvider>,
    );
    const link = screen.getByRole('link');
    expect(link.className).toContain('hidden');
    expect(link.className).toContain('md:block');
    // The base style tokens still ship.
    expect(link.className).toContain('uppercase');
  });
});
