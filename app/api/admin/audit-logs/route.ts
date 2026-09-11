/**
 * Audit Log Viewer - Phase 5
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { listAuditLogs } from "@/server/services/audit-viewer.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("audit:read");
    const sp = new URL(request.url).searchParams;
    const result = await listAuditLogs({
      userId: sp.get("userId") || undefined,
      action: sp.get("action") || undefined,
      entity: sp.get("entity") || undefined,
      entityId: sp.get("entityId") || undefined,
      from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
      to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
      search: sp.get("search") || undefined,
      limit: Math.min(parseInt(sp.get("limit") || "50"), 200),
      offset: Math.max(parseInt(sp.get("offset") || "0"), 0),
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
