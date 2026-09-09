/**
 * Company Rep Pre-Placement Talk API (read-only) — Phase 7
 *
 * GET /api/company/drives/[id]/ppt - PPT info for the caller's own drive.
 * Authorship (create/edit) stays admin-only — see the Phase 7 decision note
 * in company-rep.service.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getCompanyIdForRep, getPrePlacementTalkForCompany } from "@/server/services/company-rep.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("drive:read:own");
    const companyId = await getCompanyIdForRep(user.id as string);
    const talk = await getPrePlacementTalkForCompany(params.id, companyId);
    return NextResponse.json({ talk });
  } catch (error) {
    return handleApiError(error);
  }
}
