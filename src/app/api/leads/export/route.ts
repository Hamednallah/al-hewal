import { type NextRequest, NextResponse } from 'next/server';

import { writeAuditLog } from '@/lib/audit';
import { currentAdmin } from '@/lib/auth/admins';
import { listAllLeadsForExport, parseAdminLeadFilters } from '@/lib/data/admin-leads';
import { leadsToCsv, type LeadsCsvLocale } from '@/lib/leads-csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/leads/export?locale=<ar|en>&propertyId=…&source=…&inquiryType=…&contacted=…
 *
 * Stream a CSV of every lead matching the current Leads Journal
 * filter set. Same parse function the page uses
 * (`parseAdminLeadFilters`), so the URL the admin sees + the file
 * they download stay in sync.
 *
 * Capped at 10000 rows (`ADMIN_LEADS_EXPORT_MAX_ROWS`) per turn —
 * see `lib/data/admin-leads.ts`. The file is UTF-8 with a BOM so
 * Excel on Windows opens Arabic correctly without manual encoding
 * fiddling.
 *
 * Auth: any active admin. The PDF export queued for a follow-up PR
 * will share this route's filter parsing.
 */
export async function GET(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const searchParams: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of url.searchParams.entries()) {
    searchParams[k] = v;
  }
  const filters = parseAdminLeadFilters(searchParams);

  // Locale defaults to EN for the file; admins working in AR can pass
  // ?locale=ar to get an Arabic-headered file with localised enums.
  const localeParam = url.searchParams.get('locale');
  const locale: LeadsCsvLocale = localeParam === 'ar' ? 'ar' : 'en';

  const leads = await listAllLeadsForExport({
    propertyId: filters.propertyId,
    source: filters.source,
    inquiryType: filters.inquiryType,
    contacted: filters.contacted,
  });

  const csv = leadsToCsv(leads, locale);

  await writeAuditLog({
    actorId: admin.sub,
    action: 'update',
    entity: 'lead',
    diff: {
      action: 'export_csv',
      count: leads.length,
      locale,
      filters: {
        propertyId: filters.propertyId ?? null,
        source: filters.source ?? null,
        inquiryType: filters.inquiryType ?? null,
        contacted: filters.contacted ?? null,
      },
    },
  });

  // Suggest a dated filename so multiple exports don't collide in the
  // owner's Downloads folder.
  const today = new Date().toISOString().slice(0, 10);
  const filename = `al-hewal-leads-${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store, no-cache, must-revalidate',
    },
  });
}
