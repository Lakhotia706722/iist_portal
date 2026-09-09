/**
 * Mock Interviews (staff) - Phase 4
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import {
  listMockInterviews,
  createMockInterview,
} from "@/server/services/interview.service";
import { mockInterviewSchema } from "@/lib/validations/interview";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("interview:read:all");
    const sp = new URL(request.url).searchParams;
    const result = await listMockInterviews({
      studentId: sp.get("studentId") || undefined,
      status: sp.get("status") || undefined,
      type: sp.get("type") || undefined,
      search: sp.get("search") || undefined,
      limit: Math.min(parseInt(sp.get("limit") || "50"), 100),
      offset: Math.max(parseInt(sp.get("offset") || "0"), 0),
    });
    return NextResponse.json({ interviews: result.interviews, total: result.total });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("interview:write");
    const data = mockInterviewSchema.parse(await request.json());
    const interview = await createMockInterview(
      data,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Mock interview scheduled", interview }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
