/**
 * Student mock interview history - Phase 4
 * Always scoped to the logged-in student.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import {
  listInterviewsForStudent,
  getStudentInterviewSummary,
} from "@/server/services/interview.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("interview:read");
    const studentId = await getStudentIdFromUserId(user.id as string);
    const [interviews, summary] = await Promise.all([
      listInterviewsForStudent(studentId),
      getStudentInterviewSummary(studentId),
    ]);
    return NextResponse.json({ interviews, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
