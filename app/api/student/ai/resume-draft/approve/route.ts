/**
 * Approve an AI resume draft - Phase 5
 * POST { resumeId, targetRole, bullets } -> saves the approved bullets as a
 * new ResumeVersion, after re-validating every bullet against the student's
 * CURRENT verified profile (not just trusting the client payload).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { approveResumeDraft } from "@/server/services/ai-resume.service";
import { approveDraftSchema } from "@/lib/validations/ai";
import { handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("ai:use");
    const studentId = await getStudentIdFromUserId(user.id as string);
    const data = approveDraftSchema.parse(await request.json());
    const result = await approveResumeDraft(
      studentId,
      data.resumeId,
      data.bullets,
      data.targetRole,
      user.id as string
    );
    return NextResponse.json({
      message: `${result.savedCount} bullet(s) saved as a new resume version.${result.droppedCount > 0 ? ` ${result.droppedCount} could not be re-verified and were skipped.` : ""}`,
      ...result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
