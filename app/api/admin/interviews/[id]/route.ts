import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import {
  getMockInterviewById,
  updateMockInterview,
} from "@/server/services/interview.service";
import { updateMockInterviewSchema } from "@/lib/validations/interview";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("interview:read:all");
    return NextResponse.json({ interview: await getMockInterviewById(params.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("interview:write");
    const data = updateMockInterviewSchema.parse(await request.json());
    const interview = await updateMockInterview(
      params.id,
      data,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Interview updated", interview });
  } catch (error) {
    return handleApiError(error);
  }
}
