/**
 * Cross-drive Attendance Overview API — Phase 12
 *
 * GET /api/admin/attendance - Every round across every drive, with an
 * attendance-marking summary — backs the top-level "Attendance" nav page
 * for T&P Admin and Faculty (`attendance:read`, held by both).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listRoundsWithAttendanceSummary } from "@/server/services/attendance.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("attendance:read");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listRoundsWithAttendanceSummary({
      driveId: searchParams.get("driveId") || undefined,
      search: searchParams.get("search") || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      rounds: result.rounds,
      pagination: { total: result.total, limit, offset, hasMore: result.total > offset + limit },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
