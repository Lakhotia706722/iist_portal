/**
 * Compliance status override - Phase 5
 * PUT    - set/replace the override (requires a reason)
 * DELETE - clear the override, reverting to the computed status
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import {
  setComplianceOverride,
  clearComplianceOverride,
} from "@/server/services/compliance.service";
import { complianceOverrideSchema } from "@/lib/validations/compliance";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { studentId: string };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("compliance:write");
    const data = complianceOverrideSchema.parse(await request.json());
    const override = await setComplianceOverride(
      params.studentId,
      data.status,
      data.reason,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Compliance status overridden", override });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("compliance:write");
    await clearComplianceOverride(
      params.studentId,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Override cleared" });
  } catch (error) {
    return handleApiError(error);
  }
}
