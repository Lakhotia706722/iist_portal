/**
 * Faculty Assigned Students API — Phase 7 (read-only)
 *
 * GET /api/faculty/students - Students in the caller's department, with
 * SkillUp/mock-interview summaries. No write endpoint here by design — this
 * phase doesn't grant faculty any new write capability over student data.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listAssignedStudents } from "@/server/services/faculty.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("student:read:all");
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listAssignedStudents(user.id as string, {
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
