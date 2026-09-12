/**
 * AI Resume Match - Phase 5
 * POST { jobDescription } -> match score + breakdown against the student's
 * verified profile. Read-only; nothing is saved.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { matchResumeToJD } from "@/server/services/ai-resume.service";
import { isAIConfigured } from "@/lib/ai";
import { enforceAiUsageLimit } from "@/lib/ai/usage";
import { jdInputSchema } from "@/lib/validations/ai";
import { ServiceUnavailableError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("ai:use");
    if (!isAIConfigured()) {
      throw new ServiceUnavailableError(
        "AI features are not configured on this deployment. Set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY."
      );
    }
    await enforceAiUsageLimit(user.id as string);
    const studentId = await getStudentIdFromUserId(user.id as string);
    const data = jdInputSchema.parse(await request.json());
    const result = await matchResumeToJD(studentId, data.jobDescription, user.id as string);
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
