/**
 * HOD Department Applications API — Phase 12
 *
 * GET /api/hod/applications - Applications from the caller's own
 * department's students only (same department-scoping pattern as
 * /api/hod/students — see hod.service.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getDepartmentIdForHod, listDepartmentApplications } from "@/server/services/hod.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("application:read:all");
    const departmentId = await getDepartmentIdForHod(user.id as string);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listDepartmentApplications(departmentId, {
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      applications: result.applications,
      pagination: { total: result.total, limit, offset, hasMore: result.total > offset + limit },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
