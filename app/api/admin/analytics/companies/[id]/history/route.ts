/**
 * Company historical performance across drive years - Phase 5
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getCompanyHistoricalPerformance } from "@/server/services/analytics.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("analytics:read");
    const history = await getCompanyHistoricalPerformance(params.id);
    return NextResponse.json({ history });
  } catch (error) {
    return handleApiError(error);
  }
}
