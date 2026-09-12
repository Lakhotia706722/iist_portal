import { NextRequest } from "next/server";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { resumeVersionNoteSchema, resumeVersionUploadSchema } from "@/lib/validations/profile";
import {
  getResumeVersions,
  addResumeVersionFromUpload,
  addResumeVersionFromProfile,
} from "@/server/services/resume.service";
import { getStudentIdFromUserId } from "../../../profile/_helpers";
import { verifyUploadedObject } from "@/lib/uploads/presign";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    return Response.json(await getResumeVersions(params.id, studentId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    const contentType = req.headers.get("content-type") ?? "";

    // ?source=profile → generate from profile snapshot (no file upload)
    const { searchParams } = req.nextUrl;
    const source = searchParams.get("source");

    if (source === "profile") {
      const body = contentType.includes("application/json") ? await req.json() : {};
      const parsed = resumeVersionNoteSchema.safeParse(body);
      if (!parsed.success)
        return Response.json({ error: parsed.error.flatten() }, { status: 422 });
      const version = await addResumeVersionFromProfile(
        params.id, studentId, parsed.data.notes, actor.id
      );
      return Response.json(version, { status: 201 });
    }

    // Phase 16 — P5: confirm step after a direct-to-storage upload. The
    // client already PUT the PDF straight to storage (see
    // hooks/use-direct-upload.ts + /api/uploads/presign, which enforced
    // the PDF-only/5MB rule before ever issuing an upload URL) — this
    // just verifies the object actually landed there and records it.
    if (!contentType.includes("application/json")) {
      return Response.json({ error: "JSON body with a `key` from /api/uploads/presign is required" }, { status: 400 });
    }
    const parsed = resumeVersionUploadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    await verifyUploadedObject(parsed.data.key);

    const version = await addResumeVersionFromUpload(
      params.id, studentId, parsed.data.key, parsed.data.notes ?? undefined, actor.id
    );
    return Response.json(version, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
