/**
 * Report catalog - Phase 5
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { REPORT_LIST } from "@/lib/reports/registry";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    await requirePermission("report:read");
    return NextResponse.json({ reports: REPORT_LIST });
  } catch (error) {
    return handleApiError(error);
  }
}
