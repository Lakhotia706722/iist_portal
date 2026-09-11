/**
 * Student SkillUp performance - Phase 4
 * Category breakdown + test history for the logged-in student only.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { getStudentPerformance } from "@/server/services/skillup.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("skillup:read");
    const studentId = await getStudentIdFromUserId(user.id as string);
    return NextResponse.json(await getStudentPerformance(studentId));
  } catch (error) {
    return handleApiError(error);
  }
}
