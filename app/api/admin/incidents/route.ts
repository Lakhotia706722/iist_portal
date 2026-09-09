/**
 * Discipline Incidents - Phase 5
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { listIncidents, createIncident } from "@/server/services/compliance.service";
import { incidentSchema } from "@/lib/validations/compliance";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("incident:read");
    const sp = new URL(request.url).searchParams;
    const result = await listIncidents({
      studentId: sp.get("studentId") || undefined,
      companyId: sp.get("companyId") || undefined,
      severity: sp.get("severity") || undefined,
      status: sp.get("status") || undefined,
      violationType: sp.get("violationType") || undefined,
      search: sp.get("search") || undefined,
      limit: Math.min(parseInt(sp.get("limit") || "50"), 100),
      offset: Math.max(parseInt(sp.get("offset") || "0"), 0),
    });
    return NextResponse.json({ incidents: result.incidents, total: result.total });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("incident:write");
    const data = incidentSchema.parse(await request.json());
    const incident = await createIncident(data, user.id as string, extractRequestMeta(request));
    return NextResponse.json({ message: "Incident recorded", incident }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
