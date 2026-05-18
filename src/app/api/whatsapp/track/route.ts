import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { extractClientIp, hashIp } from '@/lib/ip';
import { whatsappTrackLimiter } from '@/lib/ratelimit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { buildWhatsappUrl } from '@/lib/whatsapp';

/**
 * GET /api/whatsapp/track[?p=<slug>&locale=ar|en]
 *
 * Records a WhatsApp conversion click and 302-redirects the visitor to
 * `wa.me/<phone>` with a pre-filled bilingual message.
 *
 * Two writes per call (best-effort — never block the redirect):
 *   1. `leads` (source='whatsapp', property_id, locale, ip_hash, ua)
 *   2. `whatsapp_clicks` (lead_id, property_id) for the analytics roll-up
 *
 * Rate-limited via Upstash (10/min/IP — generous, the conversion CTA
 * sometimes gets tapped twice by frustrated users). If rate-limited,
 * we still redirect — the user gets to WhatsApp either way, we just
 * don't log the (likely duplicate) click. Returning 429 here would
 * break the conversion funnel for a marginal anti-spam gain.
 *
 * GET (not POST) is deliberate: the CTA is a navigation. <a href> works
 * without JavaScript, and a 302 to wa.me is exactly the standard click-
 * tracking pattern. The trade-off is that GETs can be prefetched —
 * mitigated by adding `data-prefetch="false"` / `prefetch={false}` on
 * the link wrappers; even if a prefetch slips through, it just logs an
 * extra click (harmless, deduped by rate-limit).
 *
 * Free-tier impact:
 *   - 2 DB rows per real click (leads + whatsapp_clicks). At 1k clicks
 *     a month: 2k inserts, ~50KB total — negligible against Supabase's
 *     500MB free-tier ceiling.
 *   - No Vercel Blob writes, no cron.
 */

const QueryParams = z.object({
  p: z.string().min(1).max(128).optional(),
  locale: z.enum(['ar', 'en']).default('ar'),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = QueryParams.safeParse({
    p: url.searchParams.get('p') ?? undefined,
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsed.success) {
    // Bad query string — still redirect to a generic WhatsApp message
    // so the user isn't left staring at an error page. The visitor's
    // intent was to chat; we honour it.
    return NextResponse.redirect(buildWhatsappUrl({ locale: 'ar' }), 302);
  }

  const { p: slug, locale } = parsed.data;
  const ip = extractClientIp(req.headers);
  const ipHash = hashIp(ip);
  const userAgent = req.headers.get('user-agent')?.slice(0, 512) ?? null;

  // Rate-limit check. On bucket exhaustion we skip the DB writes but
  // STILL redirect — see file header for the rationale.
  let shouldRecord = true;
  if (ip) {
    try {
      const { success } = await whatsappTrackLimiter().limit(ip);
      shouldRecord = success;
    } catch (err) {
      // Upstash hiccup — treat as success so we don't drop legitimate
      // click data. The fallback limiter already returns success when
      // Upstash is absent, so this catches only transient errors.
      console.warn(
        '[whatsapp/track] ratelimit check failed (recording anyway):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  let propertyId: string | null = null;
  let propertyTitleAr: string | null = null;
  let propertyTitleEn: string | null = null;

  if (slug) {
    const client = getSupabaseAdminClient();
    const { data } = await client
      .from('properties')
      .select('id, title_ar, title_en')
      .eq('slug', slug)
      .neq('status', 'draft')
      .is('deleted_at', null)
      .maybeSingle();
    if (data) {
      const row = data as { id: string; title_ar: string; title_en: string };
      propertyId = row.id;
      propertyTitleAr = row.title_ar;
      propertyTitleEn = row.title_en;
    }
  }

  if (shouldRecord) {
    // Fire-and-forget the two inserts in parallel. Errors are logged
    // but never propagated — the user-facing redirect is the priority.
    void recordClick({
      propertyId,
      locale,
      ipHash,
      userAgent,
    });
  }

  const propertyTitle = locale === 'ar' ? propertyTitleAr : propertyTitleEn;
  const propertyUrl = slug ? `${new URL(req.url).origin}/${locale}/properties/${slug}` : null;

  return NextResponse.redirect(buildWhatsappUrl({ locale, propertyTitle, propertyUrl }), 302);
}

type RecordParams = {
  propertyId: string | null;
  locale: 'ar' | 'en';
  ipHash: string | null;
  userAgent: string | null;
};

async function recordClick({ propertyId, locale, ipHash, userAgent }: RecordParams): Promise<void> {
  try {
    const client = getSupabaseAdminClient();
    const leadRow = {
      property_id: propertyId,
      source: 'whatsapp' as const,
      locale,
      ip_hash: ipHash,
      user_agent: userAgent,
    };
    const { data, error } = await client.from('leads').insert(leadRow).select('id').single();
    if (error) {
      console.warn('[whatsapp/track] lead insert failed:', error.message);
      return;
    }
    const leadId = data?.id ?? null;
    const clickRow = { lead_id: leadId, property_id: propertyId };
    const { error: clickErr } = await client.from('whatsapp_clicks').insert(clickRow);
    if (clickErr) {
      console.warn('[whatsapp/track] click insert failed:', clickErr.message);
    }
  } catch (err) {
    console.warn(
      '[whatsapp/track] unexpected DB failure:',
      err instanceof Error ? err.message : err,
    );
  }
}
