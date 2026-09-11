/**
 * Company Rep Drive Detail API — Phase 7
 *
 * GET /api/company/drives/[id] - Scoped drive detail; 404s if the drive
 * doesn't belong to the caller's own company (see getDriveDetailForCompany).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getCompanyIdForRep, getDriveDetailForCompany } from "@/server/services/company-rep.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("drive:read:own");
    const companyId = await getCompanyIdForRep(user.id as string);
    const drive = await getDriveDetailForCompany(params.id, companyId);
    return NextResponse.json({ drive });
  } catch (error) {
    return handleApiError(error);
  }
}
