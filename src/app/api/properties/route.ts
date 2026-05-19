import { type NextRequest, NextResponse } from 'next/server';

import { currentAdmin } from '@/lib/auth/admins';
import { withAudit } from '@/lib/audit';
import { revalidatePropertyPages } from '@/lib/cache';
import { createPropertySchema, slugifyTitle } from '@/lib/validators/property';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/properties
 *
 * Admin-only. Creates a property row from the wizard's step-1 payload.
 * Admin authorisation is enforced by the middleware that gates every
 * `/admin/*` and `/api/admin/*` request — this handler additionally
 * checks `currentAdmin()` so a hypothetical matcher gap doesn't let
 * an anon caller through.
 */
export async function POST(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = createPropertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const slug = (data.slug && data.slug.length > 0 ? data.slug : slugifyTitle(data.title_en)).trim();
  if (!slug) {
    return NextResponse.json({ success: false, error: 'invalid_slug' }, { status: 400 });
  }

  try {
    const created = await withAudit(
      {
        actorId: admin.sub,
        action: 'create',
        entity: 'property',
        diff: { after: { ...data, slug } },
      },
      async () => {
        const client = getSupabaseAdminClient();
        const insertRow = {
          slug,
          title_ar: data.title_ar,
          title_en: data.title_en,
          description_ar: data.description_ar,
          description_en: data.description_en,
          type: data.type,
          status: data.status,
          price_sar: data.price_sar,
          price_negotiable: data.price_negotiable,
          area_sqm: data.area_sqm,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          city: data.city,
          district: data.district ?? null,
          plot_number: data.plot_number ?? null,
          street_width_m: data.street_width_m ?? null,
          facade: data.facade ?? null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
          google_maps_url: data.google_maps_url ?? null,
          featured: data.featured,
          created_by: admin.sub,
        };
        const { data: row, error } = await client
          .from('properties')
          .insert(insertRow)
          .select('id, slug')
          .single();
        if (error) throw error;
        return row;
      },
    );

    await revalidatePropertyPages(created.slug);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    // Supabase PostgrestError is a plain object (not an Error instance) with
    // `code` / `message` / `details` / `hint`. Earlier code only inspected
    // `err.message`, which collapsed to `[object Object]` for these
    // PostgrestErrors and prevented us from detecting the 23505 unique
    // violation — admins saw a generic 500 instead of the proper
    // `slug_taken` 409. Read the postgres error fields directly.
    const pgError = err as { code?: string; message?: string; details?: string };
    const pgCode = typeof pgError?.code === 'string' ? pgError.code : null;
    const pgMessage =
      typeof pgError?.message === 'string'
        ? pgError.message
        : err instanceof Error
          ? err.message
          : String(err);
    if (
      pgCode === '23505' ||
      pgMessage.includes('duplicate key') ||
      pgMessage.includes('properties_slug_key')
    ) {
      return NextResponse.json({ success: false, error: 'slug_taken' }, { status: 409 });
    }
    console.warn(
      '[POST /api/properties] insert failed:',
      JSON.stringify({ code: pgCode, message: pgMessage, details: pgError?.details ?? null }),
    );
    return NextResponse.json({ success: false, error: 'insert_failed' }, { status: 500 });
  }
}
