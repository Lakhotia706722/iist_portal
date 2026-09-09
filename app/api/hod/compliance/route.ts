/**
 * HOD Department Compliance API — Phase 7 (read-only)
 *
 * GET /api/hod/compliance - Compliance status for the caller's own
 * department's students. Overrides remain a TP_ADMIN-only action (see
 * compliance:write in lib/rbac/index.ts — HOD never holds it); this route
 * has no write handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getDepartmentIdForHod, getDepartmentCompliance } from "@/server/services/hod.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("compliance:read:all");
    const departmentId = await getDepartmentIdForHod(user.id as string);
    const rows = await getDepartmentCompliance(departmentId);
    return NextResponse.json({ students: rows });
  } catch (error) {
    return handleApiError(error);
  }
}
