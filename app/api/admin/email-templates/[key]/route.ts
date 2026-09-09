import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import {
  upsertEmailTemplate,
  resetEmailTemplate,
} from "@/server/services/notification.service";
import { emailTemplateSchema } from "@/lib/validations/notification";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { key: string };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("notification:template:write");
    const data = emailTemplateSchema.parse(await request.json());
    const template = await upsertEmailTemplate(
      params.key,
      data,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Template saved", template });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("notification:template:write");
    const result = await resetEmailTemplate(
      params.key,
      user.id as string,
      extractRequestMeta(request)
    );
    return NextResponse.json({ message: "Template reset to default", ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
