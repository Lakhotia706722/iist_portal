/**
 * HOD Department Offers API — Phase 12
 *
 * GET /api/hod/offers - Offers held by the caller's own department's
 * students only (same department-scoping pattern as /api/hod/students).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getDepartmentIdForHod, listDepartmentOffers } from "@/server/services/hod.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("offer:read:all");
    const departmentId = await getDepartmentIdForHod(user.id as string);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listDepartmentOffers(departmentId, {
      search: searchParams.get("search") || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      offers: result.offers,
      pagination: { total: result.total, limit, offset, hasMore: result.total > offset + limit },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
