/**
 * Company summaries - Phase 5
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listCompanySummaries } from "@/server/services/analytics.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    await requirePermission("analytics:read");
    return NextResponse.json({ companies: await listCompanySummaries() });
  } catch (error) {
    return handleApiError(error);
  }
}
