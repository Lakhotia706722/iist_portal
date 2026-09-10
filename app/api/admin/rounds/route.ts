/**
 * Cross-drive Rounds overview API — Phase 12
 *
 * GET /api/admin/rounds - Every placement round across every drive,
 * filterable. Backs the top-level "Rounds" nav page (Admin-only); creating/
 * editing a round stays on its own drive's Rounds tab.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listRoundsOverview } from "@/server/services/round.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("round:read");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listRoundsOverview({
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
