/**
 * Cross-drive Shortlisting queue API — Phase 12
 *
 * GET /api/admin/shortlisting - Applications still awaiting a shortlist
 * decision (APPLIED / UNDER_REVIEW), across every drive. Backs the
 * top-level "Shortlisting" nav page — the actual shortlist/reject/advance
 * action stays on each drive's own Shortlisting tab (built + tested in
 * Phase 9-10); this is the "which drives have applicants waiting" queue.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listAllApplications } from "@/server/services/application.service";
import { handleApiError } from "@/lib/api-utils";

const PENDING_STATUSES = ["APPLIED", "UNDER_REVIEW"];

export async function GET(request: NextRequest) {
  try {
    await requirePermission("shortlist:read");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listAllApplications({
      statuses: PENDING_STATUSES,
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
