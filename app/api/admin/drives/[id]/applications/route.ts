/**
 * Admin Drive Applications API — Phase 4
 *
 * GET /api/admin/drives/[id]/applications - Applicants for a drive, with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listApplicationsForDrive } from "@/server/services/application.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("application:read:all");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listApplicationsForDrive(params.id, {
      jobRoleId: searchParams.get("jobRoleId") || undefined,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      applications: result.applications,
      stats: result.stats,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.total > offset + limit,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
