/**
 * Email template admin - Phase 4
 * Built-in defaults merged with admin overrides.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listEmailTemplates } from "@/server/services/notification.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    await requirePermission("notification:template:read");
    return NextResponse.json({ templates: await listEmailTemplates() });
  } catch (error) {
    return handleApiError(error);
  }
}
