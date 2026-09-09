/**
 * SkillUp Tests - Phase 4
 * GET  /api/admin/skillup/tests - list
 * POST /api/admin/skillup/tests - create
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { listTests, createTest } from "@/server/services/skillup.service";
import { testSchema } from "@/lib/validations/skillup";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("skillup:read:all");
    const sp = new URL(request.url).searchParams;
    const result = await listTests({
      testTypeId: sp.get("testTypeId") || undefined,
      status: sp.get("status") || undefined,
      batchId: sp.get("batchId") || undefined,
      search: sp.get("search") || undefined,
      limit: Math.min(parseInt(sp.get("limit") || "50"), 100),
      offset: Math.max(parseInt(sp.get("offset") || "0"), 0),
    });
    return NextResponse.json({ tests: result.tests, total: result.total });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("skillup:write");
    const data = testSchema.parse(await request.json());
    const test = await createTest(data, user.id as string, extractRequestMeta(request));
    return NextResponse.json({ message: "Test created", test }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
