/**
 * Company Rep Applicants API — Phase 7
 *
 * GET /api/company/drives/[id]/applicants - Applicants to the caller's own
 * drive, through the strict field allowlist in company-rep.service.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getCompanyIdForRep, listApplicantsForCompanyDrive } from "@/server/services/company-rep.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("application:read:company");
    const companyId = await getCompanyIdForRep(user.id as string);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const result = await listApplicantsForCompanyDrive(params.id, companyId, {
      jobRoleId: searchParams.get("jobRoleId") || undefined,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      applicants: result.applicants,
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
