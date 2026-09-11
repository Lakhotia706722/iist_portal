/**
 * Admin Command Center metrics - Phase 5
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getCommandCenterMetrics } from "@/server/services/analytics.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    await requirePermission("analytics:read");
    return NextResponse.json(await getCommandCenterMetrics());
  } catch (error) {
    return handleApiError(error);
  }
}
