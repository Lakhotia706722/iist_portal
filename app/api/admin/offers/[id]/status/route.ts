/**
 * Admin Offer Status API — Phase 3.5
 *
 * PATCH /api/admin/offers/[id]/status - Move an offer through its lifecycle
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { updateOfferStatus } from "@/server/services/offer.service";
import { assertOfferOwnedByCallerIfCompanyRep } from "@/server/services/company-rep.service";
import { offerStatusSchema } from "@/lib/validations/offer";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("offer:write");
    // Phase 7: offer:write is also held by COMPANY_REP — without this check
    // any company rep could change the status of any company's offer.
    await assertOfferOwnedByCallerIfCompanyRep(params.id, user as { id: string; role?: string });

    const body = await request.json();
    const { status, note } = offerStatusSchema.parse(body);

    const offer = await updateOfferStatus(
      params.id,
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
