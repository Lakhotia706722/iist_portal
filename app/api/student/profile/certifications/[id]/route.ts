import { NextRequest } from "next/server";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { certificationSchema } from "@/lib/validations/profile";
import { updateCertification, deleteCertification } from "@/server/services/certification.service";
import { getStudentIdFromUserId, parseBodyWithOptionalFile } from "../../_helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    const { body, fileKey } = await parseBodyWithOptionalFile(req, "certificate", "certifications", studentId);
    const parsed = certificationSchema.partial().safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    return Response.json(await updateCertification(params.id, studentId, parsed.data, actor.id, fileKey));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    await deleteCertification(params.id, studentId, actor.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
