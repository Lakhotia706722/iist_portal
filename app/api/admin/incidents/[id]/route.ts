import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { getIncidentById, updateIncident } from "@/server/services/compliance.service";
import { updateIncidentSchema } from "@/lib/validations/compliance";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("incident:read");
    return NextResponse.json({ incident: await getIncidentById(params.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("incident:write");
    const data = updateIncidentSchema.parse(await request.json());
    const incident = await updateIncident(
      params.id,
      data,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Incident updated", incident });
  } catch (error) {
    return handleApiError(error);
  }
}
