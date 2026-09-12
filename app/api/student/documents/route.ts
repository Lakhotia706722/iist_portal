import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { documentConfirmSchema } from "@/lib/validations/profile";
import { getDocuments, uploadDocument } from "@/server/services/document.service";
import { getStudentIdFromUserId } from "../profile/_helpers";
import { verifyUploadedObject } from "@/lib/uploads/presign";

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    return Response.json(await getDocuments(studentId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);

    // Phase 16 — P5: the client uploads directly to storage (see
    // hooks/use-direct-upload.ts) — type/size were already validated by
    // /api/uploads/presign before an upload URL was even issued. This
    // just verifies the object exists before recording it.
    const parsed = documentConfirmSchema.safeParse(await req.json());
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });

    await verifyUploadedObject(parsed.data.key);

    const doc = await uploadDocument(
      studentId,
      { type: parsed.data.type, name: parsed.data.name },
      parsed.data.key,
      parsed.data.mimeType,
      parsed.data.sizeBytes,
      actor.id
    );
    return Response.json(doc, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

