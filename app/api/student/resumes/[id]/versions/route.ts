import { NextRequest } from "next/server";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { resumeVersionNoteSchema } from "@/lib/validations/profile";
import {
  getResumeVersions,
  addResumeVersionFromUpload,
  addResumeVersionFromProfile,
} from "@/server/services/resume.service";
import { getStudentIdFromUserId } from "../../../profile/_helpers";
import { getStorageAdapter } from "@/lib/storage";
import { randomUUID } from "crypto";

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

    // Upload a PDF file
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "Multipart form data required for file upload" }, { status: 400 });
    }

    const formData = await req.formData();
    const notes = formData.get("notes") as string | null;
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 422 });
    }
    if (file.type !== "application/pdf") {
      return Response.json({ error: "Only PDF files are allowed for resumes" }, { status: 422 });
    }
    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxBytes) {
      return Response.json({ error: "Resume PDF must be under 5 MB" }, { status: 422 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = `resumes/${studentId}/${params.id}/${randomUUID()}-${file.name}`;
    await getStorageAdapter().upload(fileKey, buffer, file.type);

    const version = await addResumeVersionFromUpload(
      params.id, studentId, fileKey, notes ?? undefined, actor.id
    );
    return Response.json(version, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
