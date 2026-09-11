import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getAuditLogById } from "@/server/services/audit-viewer.service";
import { NotFoundError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("audit:read");
    const log = await getAuditLogById(params.id);
    if (!log) throw new NotFoundError("Audit log entry not found");
    return NextResponse.json({ log });
  } catch (error) {
    return handleApiError(error);
  }
}
