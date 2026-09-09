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
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new BadRequestError("No file provided");

    const incident = await uploadIncidentDocument(
      params.id,
      file,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Evidence uploaded", incident });
  } catch (error) {
    return handleApiError(error);
  }
}
