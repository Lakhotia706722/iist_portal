/**
 * SkillUp Test Types - Phase 4
 * Categories are data, so admins can add new ones without a migration.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { listTestTypes, createTestType } from "@/server/services/skillup.service";
import { testTypeSchema } from "@/lib/validations/skillup";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("skillup:read");
    const includeInactive =
      new URL(request.url).searchParams.get("includeInactive") === "true";
    return NextResponse.json({ testTypes: await listTestTypes(includeInactive) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("skillup:write");
    const data = testTypeSchema.parse(await request.json());
    const testType = await createTestType(
      data,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Test type created", testType }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
