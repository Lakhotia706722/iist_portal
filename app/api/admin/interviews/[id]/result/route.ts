import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { recordInterviewResult } from "@/server/services/interview.service";
import { interviewResultSchema } from "@/lib/validations/interview";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("interview:write");
    const data = interviewResultSchema.parse(await request.json());
    const interview = await recordInterviewResult(
      params.id,
      data,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Feedback recorded", interview });
  } catch (error) {
    return handleApiError(error);
  }
}
