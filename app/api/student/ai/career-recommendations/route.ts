/**
 * AI career recommendations - Phase 5
 * Advisory only, clearly AI-generated. Not tied to any specific application.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getStudentIdFromUserId } from "@/lib/auth/student-session";
import { getCareerRecommendations } from "@/server/services/ai-resume.service";
import { isAIConfigured } from "@/lib/ai";
import { enforceAiUsageLimit } from "@/lib/ai/usage";
import { careerRecommendationSchema } from "@/lib/validations/ai";
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
    const body = await request.json().catch(() => ({}));
    const data = careerRecommendationSchema.parse(body);
    const recommendations = await getCareerRecommendations(studentId, data.interests, user.id as string);
    return NextResponse.json({ recommendations });
  } catch (error) {
    return handleApiError(error);
  }
}
