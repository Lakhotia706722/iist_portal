/**
 * HOD Dashboard API — Phase 7
 *
 * GET /api/hod/dashboard - Department-scoped student counts + analytics.
 * departmentId is resolved server-side from the caller's own HodProfile —
 * never accepted from the client, so an HOD cannot request another
 * department's data by passing a different id.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getDepartmentIdForHod, getHodDashboard } from "@/server/services/hod.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("analytics:read");
    const departmentId = await getDepartmentIdForHod(user.id as string);
    const dashboard = await getHodDashboard(departmentId);
    return NextResponse.json(dashboard);
  } catch (error) {
    return handleApiError(error);
  }
}
