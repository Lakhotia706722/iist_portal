import { getStorageAdapter } from "@/lib/storage";
import { randomUUID } from "crypto";
import { ValidationError } from "@/lib/errors";

export { getStudentIdFromUserId } from "@/lib/auth/student-session";

/** Shared across profile-section uploads (certificates, project images, etc.). */
const DEFAULT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Upload a file from multipart form. Returns the storage key.
 *
 * Phase 5: this used to upload whatever was posted with no type or size
 * check — every achievement/certification/internship "certificate" upload
 * went through here unvalidated. Now validated with a shared allowlist,
 * overridable per-call for routes with different needs (e.g. video uploads).
 */
export async function uploadFile(
  file: File,
  prefix: string,
  studentId: string,
  options: { allowedMimeTypes?: string[]; maxBytes?: number } = {},
): Promise<string> {
  const allowed = options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (!allowed.includes(file.type)) {
    throw new ValidationError(
      `Unsupported file type "${file.type || "unknown"}". Allowed: ${allowed.join(", ")}`
    );
  }
  if (file.size > maxBytes) {
    throw new ValidationError(`File must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `${prefix}/${studentId}/${randomUUID()}-${file.name}`;
  await getStorageAdapter().upload(key, buffer, file.type);
  return key;
}

/** Parse body: handles both JSON and multipart (returns parsed body + optional file key) */
export async function parseBodyWithOptionalFile(
  req: Request,
  fileField: string,
  storagePrefix: string,
  studentId: string,
  fileOptions?: { allowedMimeTypes?: string[]; maxBytes?: number },
): Promise<{ body: any; fileKey?: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await (req as any).formData();
    const body = JSON.parse(formData.get("data") as string);
    const file = formData.get(fileField) as File | null;
    const fileKey = file ? await uploadFile(file, storagePrefix, studentId, fileOptions) : undefined;
    return { body, fileKey };
  }
  return { body: await (req as any).json() };
}
