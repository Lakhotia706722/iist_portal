import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { internshipSchema } from "@/lib/validations/profile";
import { getInternships, createInternship } from "@/server/services/internship.service";
import { getStudentIdFromUserId, parseBodyWithOptionalFile } from "../_helpers";

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    return Response.json(await getInternships(studentId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    const { body, fileKey } = await parseBodyWithOptionalFile(req);
    const parsed = internshipSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const item = await createInternship(studentId, parsed.data, actor.id, fileKey);
    return Response.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

