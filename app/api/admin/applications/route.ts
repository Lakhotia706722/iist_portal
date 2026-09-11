/**
 * Cross-drive Applications API — Phase 12
 *
 * GET /api/admin/applications - Every application across every drive,
 * filterable — backs the top-level "Applications" nav page for both
 * T&P Admin and Faculty (gated by `application:read:all`, which both
 * roles hold; the frontend hides any write actions Faculty can't do).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listAllApplications } from "@/server/services/application.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("application:read:all");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listAllApplications({
      driveId: searchParams.get("driveId") || undefined,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      branchId: searchParams.get("branchId") || undefined,
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
