/**
 * Job recommendations - Phase 5
 * Deterministic skill-overlap ranking against real open JobRoles — not an
 * AI hallucination of jobs that may not exist.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { getJobRecommendations } from "@/server/services/ai-resume.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("ai:use");
    const studentId = await getStudentIdFromUserId(user.id as string);
    const recommendations = await getJobRecommendations(studentId);
    return NextResponse.json({ recommendations });
  } catch (error) {
    return handleApiError(error);
  }
}
