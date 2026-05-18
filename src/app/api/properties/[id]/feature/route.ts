import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { handlePropertyAction } from '@/lib/admin/property-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ featured: z.boolean() });

/**
 * POST /api/properties/[id]/feature
 *
 * Set the `featured` flag (true = highlight on home, false = unhighlight).
 * Client sends `{ featured: boolean }` — the opposite of the row's
 * current state — so the route is idempotent and free of stale-read
 * races (no read-modify-write here).
 *
 * Tier gate: `super_admin` ONLY. Featuring drives the public home page's
 * curated list; the master plan reserves this lever for super admins.
 * On success, calls `revalidateAfterFeatureToggle()` (lighter than the
 * full property revalidation — only the home + catalog index changed).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
  }
  const featured = parsed.data.featured;
  const { id } = await ctx.params;
  return handlePropertyAction(id, {
    auditAction: 'feature_toggle',
    requireTier: 'super_admin',
    buildAuditDiff: () => ({ after: { featured } }),
    mutate: async (client, rowId) => {
      const { data, error } = await client
        .from('properties')
        .update({ featured, updated_at: new Date().toISOString() } as never)
        .eq('id', rowId)
        .select('slug')
        .single();
      if (error) throw error;
      return { slug: (data as { slug: string }).slug, featureToggleOnly: true };
    },
  });
}
