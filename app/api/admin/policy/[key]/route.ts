/**
 * Policy rule - Phase 5
 * PUT    - set the value at a scope (global, or a specific batch)
 * DELETE - remove an override (?batchId=... or global if omitted) so the
 *          key reverts to its default / the next-broadest scope
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { setPolicyRule, deletePolicyRule } from "@/server/services/policy.service";
import { setPolicyRuleSchema } from "@/lib/validations/policy";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { key: string };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("policy:write");
    const data = setPolicyRuleSchema.parse(await request.json());
    const rule = await setPolicyRule(
      params.key,
      data.value,
      data.batchId ?? null,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Policy updated", rule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("policy:write");
    const batchId = new URL(request.url).searchParams.get("batchId");

    const existing = await prisma.policyRule.findFirst({
      where: { key: params.key, batchId: batchId || null },
    });
    if (!existing) throw new NotFoundError("No override at this scope to remove");

    await deletePolicyRule(existing.id, user.id as string, extractRequestMeta(request));
    return NextResponse.json({ message: "Reverted to default" });
  } catch (error) {
    return handleApiError(error);
  }
}
