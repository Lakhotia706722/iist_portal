/**
 * Company Rep Offer Status API — Phase 7
 *
 * PATCH /api/company/offers/[id]/status - Move an offer through its
 * lifecycle, scoped to offers tied to the caller's own company (see
 * updateOfferStatusForCompany — 404s rather than 403s on a foreign offer,
 * same reasoning as the drive-detail route).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { getCompanyIdForRep, updateOfferStatusForCompany } from "@/server/services/company-rep.service";
import { offerStatusSchema } from "@/lib/validations/offer";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("offer:write");
    const companyId = await getCompanyIdForRep(user.id as string);

    const body = await request.json();
    const { status, note } = offerStatusSchema.parse(body);

    const offer = await updateOfferStatusForCompany(
      params.id,
      companyId,
      status,
      user.id as string,
      note,
      extractRequestMeta(request)
    );

    return NextResponse.json({ message: `Offer marked ${status}`, offer });
  } catch (error) {
    return handleApiError(error);
  }
}
