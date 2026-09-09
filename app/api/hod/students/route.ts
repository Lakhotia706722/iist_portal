/**
 * HOD Department Students API — Phase 7
 *
 * GET /api/hod/students - Students in the caller's own department only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getDepartmentIdForHod, listDepartmentStudents } from "@/server/services/hod.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("student:read:all");
    const departmentId = await getDepartmentIdForHod(user.id as string);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listDepartmentStudents(departmentId, {
      search: searchParams.get("search") || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      students: result.students,
      pagination: { total: result.total, limit, offset, hasMore: result.total > offset + limit },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
