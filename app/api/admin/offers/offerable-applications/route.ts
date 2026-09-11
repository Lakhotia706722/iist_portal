/**
 * Offerable Applications — Phase 3.5
 *
 * GET /api/admin/offers/offerable-applications
 * Applications marked SELECTED that don't yet have an offer recorded.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listOfferableApplications } from "@/server/services/offer.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("offer:write");
    const driveId = new URL(request.url).searchParams.get("driveId") ?? undefined;
    const applications = await listOfferableApplications(driveId);
    return NextResponse.json({ applications });
  } catch (error) {
    return handleApiError(error);
  }
}
