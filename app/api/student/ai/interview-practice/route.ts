/**
 * AI mock-interview practice feedback - Phase 5
 *
 * Purely additive self-practice tool: instant AI feedback on a
 * question/answer pair the student submits. NOT persisted as an official
 * MockInterview/InterviewResult record — those stay faculty-entered per the
 * Phase 4 design. Nothing here is saved.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getInterviewPracticeFeedback } from "@/server/services/ai-resume.service";
import { isAIConfigured } from "@/lib/ai";
import { interviewPracticeSchema } from "@/lib/validations/ai";
import { ServiceUnavailableError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    await requirePermission("ai:use");
    if (!isAIConfigured()) {
      throw new ServiceUnavailableError(
        "AI features are not configured on this deployment. Set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY."
      );
    }
    const data = interviewPracticeSchema.parse(await request.json());
    const feedback = await getInterviewPracticeFeedback(data.question, data.answer);
    return NextResponse.json({ feedback });
  } catch (error) {
    return handleApiError(error);
  }
}
