/**
 * Department/branch/course/batch analytics - Phase 5
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getDepartmentAnalytics, getDepartmentBreakdown } from "@/server/services/analytics.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("analytics:read");
    const sp = new URL(request.url).searchParams;
    const filters = {
      departmentId: sp.get("departmentId") || undefined,
      branchId: sp.get("branchId") || undefined,
      courseId: sp.get("courseId") || undefined,
      batchId: sp.get("batchId") || undefined,
      semester: sp.get("semester") ? Number(sp.get("semester")) : undefined,
    };
    const [analytics, breakdown] = await Promise.all([
      getDepartmentAnalytics(filters),
      getDepartmentBreakdown(),
    ]);
    return NextResponse.json({ analytics, breakdown });
  } catch (error) {
    return handleApiError(error);
  }
}
