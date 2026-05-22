import { describe, expect, it } from 'vitest';

process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'a'.repeat(60);
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 's'.repeat(60);
process.env.NEXT_PUBLIC_WHATSAPP_PHONE ??= '966500000000';

import { buildWhatsappUrl } from './whatsapp';

function extractMessage(url: string): string {
  const u = new URL(url);
  return u.searchParams.get('text') ?? '';
}

describe('buildWhatsappUrl', () => {
  it('targets wa.me with the configured phone digits', () => {
    const url = buildWhatsappUrl({ locale: 'en' });
    expect(url.startsWith('https://wa.me/966500000000?text=')).toBe(true);
  });

  it('emits the EN generic message when no property is supplied', () => {
    const msg = extractMessage(buildWhatsappUrl({ locale: 'en' }));
    expect(msg).toBe('Hello Al Haual, I would like to enquire about your real-estate projects.');
  });

  it('emits the AR generic message when no property is supplied', () => {
    const msg = extractMessage(buildWhatsappUrl({ locale: 'ar' }));
    expect(msg).toContain('الحوال');
    expect(msg).toContain('عقارية');
  });

  it('embeds title and URL in the EN property-specific message', () => {
    const msg = extractMessage(
      buildWhatsappUrl({
        locale: 'en',
        propertyTitle: 'Al Dana Project 21',
        propertyUrl: 'https://al-hewal.example/en/properties/al-dana-21',
      }),
    );
    expect(msg).toContain('Al Dana Project 21');
    expect(msg).toContain('https://al-hewal.example/en/properties/al-dana-21');
  });

  it('embeds title (but not URL) when only title is supplied', () => {
    const msg = extractMessage(
      buildWhatsappUrl({ locale: 'en', propertyTitle: 'Al Yasmin Villa 7' }),
    );
    expect(msg).toContain('Al Yasmin Villa 7');
    expect(msg).not.toContain('http');
  });

  it('AR message with property contains the title in Arabic context', () => {
    const msg = extractMessage(
      buildWhatsappUrl({
        locale: 'ar',
        propertyTitle: 'مشروع الدانة 21',
        propertyUrl: 'https://al-hewal.example/ar/properties/al-dana-21',
      }),
    );
    expect(msg).toContain('مشروع الدانة 21');
    expect(msg).toContain('https://al-hewal.example/ar/properties/al-dana-21');
  });
});
