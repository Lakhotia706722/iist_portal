import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { documentUploadSchema } from "@/lib/validations/profile";
import { getDocuments, uploadDocument } from "@/server/services/document.service";
import { getStudentIdFromUserId } from "../profile/_helpers";
import { getStorageAdapter } from "@/lib/storage";
import { randomUUID } from "crypto";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "Multipart form data required" }, { status: 400 });
    }

    const formData = await req.formData();
    const meta = JSON.parse(formData.get("data") as string);
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 422 });
    }

    // Server-side validation
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return Response.json(
        { error: "Only PDF, JPEG, PNG and WebP files are allowed" },
        { status: 422 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return Response.json({ error: "File must be under 10 MB" }, { status: 422 });
    }

    const parsed = documentUploadSchema.safeParse(meta);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = `documents/${studentId}/${randomUUID()}-${file.name}`;
    await getStorageAdapter().upload(fileKey, buffer, file.type);

    const doc = await uploadDocument(
      studentId,
      parsed.data,
      fileKey,
      file.type,
      file.size,
      actor.id
    );
    return Response.json(doc, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

