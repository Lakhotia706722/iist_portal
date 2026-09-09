/**
 * Compliance status (staff view of any student) - Phase 5
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getComplianceStatus } from "@/server/services/compliance.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { studentId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("compliance:read:all");
    return NextResponse.json(await getComplianceStatus(params.studentId));
  } catch (error) {
    return handleApiError(error);
  }
}
