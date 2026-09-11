/**
 * Company Rep Dashboard API — Phase 7
 *
 * GET /api/company/dashboard - The caller's own company's drives + funnel summary
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getCompanyIdForRep, getCompanyRepDashboard } from "@/server/services/company-rep.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("drive:read:own");
    const companyId = await getCompanyIdForRep(user.id as string);
    const dashboard = await getCompanyRepDashboard(companyId);
    return NextResponse.json(dashboard);
  } catch (error) {
    return handleApiError(error);
  }
}
