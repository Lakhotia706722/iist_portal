/**
 * Faculty Dashboard API — Phase 7
 *
 * GET /api/faculty/dashboard - Own created tests/interviews + a
 * department-scoped "needs attention" list.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getFacultyDashboard } from "@/server/services/faculty.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("skillup:read:all");
    const dashboard = await getFacultyDashboard(user.id as string);
    return NextResponse.json(dashboard);
  } catch (error) {
    return handleApiError(error);
  }
}
