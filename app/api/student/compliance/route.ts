/**
 * Student's own compliance status - Phase 5
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { getComplianceStatus } from "@/server/services/compliance.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("compliance:read:own");
    const studentId = await getStudentIdFromUserId(user.id as string);
    return NextResponse.json(await getComplianceStatus(studentId));
  } catch (error) {
    return handleApiError(error);
  }
}
