import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { getStudentTestResult } from "@/server/services/skillup.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { testId: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("skillup:read");
    const studentId = await getStudentIdFromUserId(user.id as string);
    // Scoped by studentId, so a student can only ever read their own result.
    return NextResponse.json({
      result: await getStudentTestResult(studentId, params.testId),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
