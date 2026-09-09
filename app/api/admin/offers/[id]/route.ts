/**
 * Admin Offer Detail API — Phase 3.5
 *
 * GET   /api/admin/offers/[id] - Offer detail
 * PATCH /api/admin/offers/[id] - Update offer details
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { getOfferById, updateOffer } from "@/server/services/offer.service";
import { updateOfferSchema } from "@/lib/validations/offer";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("offer:read:all");
    const offer = await getOfferById(params.id);
    return NextResponse.json({ offer });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("offer:write");

    const body = await request.json();
    const data = updateOfferSchema.parse(body);

    const offer = await updateOffer(
      params.id,
      data,
      user.id as string,
      extractRequestMeta(request)
    );

    return NextResponse.json({ message: "Offer updated", offer });
  } catch (error) {
    return handleApiError(error);
  }
}
