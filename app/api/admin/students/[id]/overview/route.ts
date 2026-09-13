/**
 * Admin student-detail overview — Phase 17 P5.
 * GET - applications, offers, SkillUp results, mock interviews, and resumes
 *       for one student, unrestricted (TP_ADMIN only). Personal/academic
 *       profile data lives in /api/student/profile/career?studentId=...;
 *       documents/compliance are served by their own existing endpoints.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentAdminOverview } from "@/server/services/student.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission("student:read:all");
    const overview = await getStudentAdminOverview(params.id);
    return NextResponse.json(overview);
  } catch (error) {
    return handleApiError(error);
  }
}
