import { type NextRequest, NextResponse } from 'next/server';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { z } from 'zod';

import { env } from '@/lib/env';
import { extractClientIp, hashIp } from '@/lib/ip';
import { leadsContactLimiter } from '@/lib/ratelimit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/leads
 *
 * Public contact-form endpoint. Validates the JSON body with Zod,
 * normalises the phone number to E.164 via libphonenumber-js (default
 * region: SA — the audience), hashes the IP, and inserts a `leads` row
 * via the service-role client.
 *
 * Rate-limited at 5/min per IP — stricter than the WhatsApp tracker
 * because each accepted lead has a higher downstream cost (email
 * notification + admin review). Returns 429 on bucket exhaustion;
 * the contact form polls this directly so the response code matters.
 *
 * Origin check: we reject requests whose `Origin` header isn't our
 * site URL. This blocks the trivial cross-origin abuse vector while
 * leaving the route open to legitimate same-origin submissions and
 * native mobile apps (which may omit Origin entirely).
 *
 * The contact form lives in PR 2.6+ as a separate page — this route
 * lands now so the next PR can wire the form to it without API
 * scaffolding noise in that diff.
 */

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(6).max(40),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  message: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  propertyId: z.string().uuid().optional(),
  locale: z.enum(['ar', 'en']).default('ar'),
  // Topic classification — backed by the inquiry_type enum added in
  // migration 0004. Defaults to 'general' so older clients (and the
  // property-detail page's "Contact via WhatsApp" pathway) keep
  // working without sending the new field.
  inquiryType: z.enum(['general', 'maintenance']).default('general'),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Origin guard. The site URL is the only legitimate caller.
  const origin = req.headers.get('origin');
  if (origin && origin !== env.NEXT_PUBLIC_SITE_URL) {
    return NextResponse.json({ success: false, error: 'forbidden_origin' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Phone normalisation. Saudi region default for bare numbers; if the
  // user typed +<country><digits> the parser respects it.
  const phoneParsed = parsePhoneNumberFromString(parsed.data.phone, 'SA');
  if (!phoneParsed || !phoneParsed.isValid()) {
    return NextResponse.json({ success: false, error: 'invalid_phone' }, { status: 400 });
  }
  const phoneE164 = phoneParsed.number; // includes leading '+'

  const ip = extractClientIp(req.headers);
  if (ip) {
    try {
      const { success } = await leadsContactLimiter().limit(ip);
      if (!success) {
        return NextResponse.json({ success: false, error: 'rate_limited' }, { status: 429 });
      }
    } catch (err) {
      console.warn(
        '[leads] ratelimit check failed (accepting submission):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const ipHash = hashIp(ip);
  const userAgent = req.headers.get('user-agent')?.slice(0, 512) ?? null;
  const referrer = req.headers.get('referer')?.slice(0, 512) ?? null;

  try {
    const client = getSupabaseAdminClient();
    // Cast at the insert boundary — see note in lib/audit.ts.
    const leadRow = {
      property_id: parsed.data.propertyId ?? null,
      source: 'contact_form',
      inquiry_type: parsed.data.inquiryType,
      name: parsed.data.name,
      phone: phoneE164,
      email: parsed.data.email ?? null,
      message: parsed.data.message ?? null,
      locale: parsed.data.locale,
      ip_hash: ipHash,
      user_agent: userAgent,
      referrer,
    };
    const { error } = await client.from('leads').insert(leadRow as never);
    if (error) {
      console.warn('[leads] insert failed:', error.message);
      return NextResponse.json({ success: false, error: 'insert_failed' }, { status: 500 });
    }
  } catch (err) {
    console.warn('[leads] unexpected DB failure:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
