/**
 * AI Resume Draft - Phase 5
 * POST { targetRole, jobDescription } -> bullets drafted strictly from the
 * student's verified profile facts. Any bullet the server can't trace back
 * to a real profile fact is dropped before it reaches this response.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { generateResumeDraft } from "@/server/services/ai-resume.service";
import { isAIConfigured } from "@/lib/ai";
import { draftResumeSchema } from "@/lib/validations/ai";
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
    const studentId = await getStudentIdFromUserId(user.id as string);
    const data = draftResumeSchema.parse(await request.json());
    const result = await generateResumeDraft(studentId, data.targetRole, data.jobDescription);
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
