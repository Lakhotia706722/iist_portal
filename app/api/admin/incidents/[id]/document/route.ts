import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { uploadIncidentDocument } from "@/server/services/compliance.service";
import { BadRequestError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("incident:write");
    const { key } = await request.json();
    if (!key || typeof key !== "string") throw new BadRequestError("No document key provided");

    const incident = await uploadIncidentDocument(
      params.id,
      key,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Evidence uploaded", incident });
  } catch (error) {
    return handleApiError(error);
  }
}
