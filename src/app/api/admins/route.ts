import { type NextRequest, NextResponse } from 'next/server';

import { currentAdmin } from '@/lib/auth/admins';
import { writeAuditLog } from '@/lib/audit';
import { inviteAdmin } from '@/lib/data/admins';
import { env } from '@/lib/env';
import { inviteAdminSchema } from '@/lib/validators/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admins
 *
 * Invite a new admin (super_admin only). Sends a Supabase Auth invite
 * email AND inserts the matching `public.admins` row with
 * `status='pending_invite'`. The invitee accepts by clicking the email
 * link, which lands on `/<locale>/auth/reset-password?code=…` — the same
 * page that handles password recovery. Once they set a password, our
 * existing recovery flow flips them to `status='active'`.
 *
 * If Supabase Hobby SMTP is flaky and the email never lands, the
 * runbook §1 SQL fallback still works — the `public.admins` row exists
 * with the right tier + status, and the SQL `update auth.users set
 * encrypted_password = …` snippet can substitute for the invite link.
 */
export async function POST(req: NextRequest) {
  const actor = await currentAdmin();
  if (!actor) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  if (actor.tier !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = inviteAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Invite link redirects to the existing reset-password page; default
  // to the inviter's language preference for a coherent first impression.
  const locale = input.language_pref;
  const redirectTo = `${env.NEXT_PUBLIC_SITE_URL}/${locale}/auth/reset-password`;

  const result = await inviteAdmin({
    email: input.email,
    full_name: input.full_name,
    tier: input.tier,
    language_pref: input.language_pref,
    redirectTo,
  });

  if (!result.ok) {
    // Audit the failed attempt so super_admins see attempted invites in
    // the log even when SMTP / Supabase had a bad day.
    await writeAuditLog({
      actorId: actor.sub,
      action: 'invite',
      entity: 'admin',
      diff: { email: input.email, tier: input.tier, error: result.code, detail: result.detail },
    });
    const status =
      result.code === 'email_taken' ? 409 : result.code === 'invite_failed' ? 502 : 500;
    return NextResponse.json({ success: false, error: result.code }, { status });
  }

  await writeAuditLog({
    actorId: actor.sub,
    action: 'invite',
    entity: 'admin',
    entityId: result.id,
    diff: { after: { email: input.email, full_name: input.full_name, tier: input.tier } },
  });

  return NextResponse.json({ success: true, data: { id: result.id } }, { status: 201 });
}
