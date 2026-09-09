/**
 * Company Rep Offers API — Phase 7
 *
 * GET /api/company/offers - Offers tied to the caller's own company's
 * drives. Fixes the scoping gap flagged in Phase 3.5/4: offer:read for a
 * company rep is now always filtered server-side to their own companyId,
 * never a blanket list (that's what offer:read:all is for, and COMPANY_REP
 * never holds it).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getCompanyIdForRep, listOffersForCompany } from "@/server/services/company-rep.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("offer:read:company");
    const companyId = await getCompanyIdForRep(user.id as string);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listOffersForCompany(companyId, {
      status: searchParams.get("status") || undefined,
      driveId: searchParams.get("driveId") || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      offers: result.offers,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.total > offset + limit,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
