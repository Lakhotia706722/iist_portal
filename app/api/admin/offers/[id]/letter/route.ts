/**
 * Admin Offer Letter Upload — Phase 3.5
 *
 * POST /api/admin/offers/[id]/letter - Upload the signed offer letter (PDF)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { uploadOfferLetter } from "@/server/services/offer.service";
import { assertOfferOwnedByCallerIfCompanyRep } from "@/server/services/company-rep.service";
import { BadRequestError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("offer:write");
    // Phase 7: offer:write is also held by COMPANY_REP — without this check
    // any company rep could upload a letter onto any company's offer.
    await assertOfferOwnedByCallerIfCompanyRep(params.id, user as { id: string; role?: string });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new BadRequestError("No offer letter file provided");
    }

    const offer = await uploadOfferLetter(
      params.id,
      file,
      user.id as string,
      extractRequestMeta(request)
    );

    return NextResponse.json({ message: "Offer letter uploaded", offer });
  } catch (error) {
    return handleApiError(error);
  }
}
