/**
 * Policy Engine - Phase 5
 * GET /api/admin/policy - every policy key merged with its current value(s)
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listPolicyRules } from "@/server/services/policy.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    await requirePermission("policy:read");
    return NextResponse.json({ rules: await listPolicyRules() });
  } catch (error) {
    return handleApiError(error);
  }
}
