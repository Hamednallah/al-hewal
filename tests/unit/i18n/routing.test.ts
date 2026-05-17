import { describe, expect, it } from 'vitest';

import { getDirection, isLocale, routing } from '@/i18n/routing';

describe('i18n routing config', () => {
  it('exposes both supported locales', () => {
    expect(routing.locales).toEqual(['ar', 'en']);
  });

  it('defaults to Arabic for the Saudi-first audience', () => {
    expect(routing.defaultLocale).toBe('ar');
  });

  it('always prefixes the URL with a locale', () => {
    expect(routing.localePrefix).toBe('always');
  });
});

describe('isLocale', () => {
  it('accepts known locales', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('en')).toBe(true);
  });

  it('rejects unknown locales', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(123)).toBe(false);
  });
});

describe('getDirection', () => {
  it('returns rtl for Arabic', () => {
    expect(getDirection('ar')).toBe('rtl');
  });

  it('returns ltr for English', () => {
    expect(getDirection('en')).toBe('ltr');
  });
});
