import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { documentVerifySchema } from "@/lib/validations/profile";
import { adminVerifyDocument } from "@/server/services/document.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requirePermission("document:verify");
    const body = await req.json();
    const parsed = documentVerifySchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const doc = await adminVerifyDocument(params.id, parsed.data, actor.id);
    return Response.json(doc);
  } catch (err) {
    return errorResponse(err);
  }
}
