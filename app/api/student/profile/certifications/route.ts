import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { certificationSchema } from "@/lib/validations/profile";
import { getCertifications, createCertification } from "@/server/services/certification.service";
import { getStudentIdFromUserId, parseBodyWithOptionalFile } from "../_helpers";

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    return Response.json(await getCertifications(studentId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    const { body, fileKey } = await parseBodyWithOptionalFile(req, "certificate", "certifications", studentId);
    const parsed = certificationSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const item = await createCertification(studentId, parsed.data, actor.id, fileKey);
    return Response.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

