import { verifyUploadedObject } from "@/lib/uploads/presign";

export { getStudentIdFromUserId } from "@/lib/auth/student-session";

/**
 * Phase 16 — P5: the client now uploads directly to storage (see
 * hooks/use-direct-upload.ts + POST /api/uploads/presign, which validate
 * type/size *before* issuing an upload URL — Phase 5's P8 requirement
 * doesn't relax just because bytes no longer proxy through this route)
 * and sends the resulting key as a plain JSON field alongside the rest of
 * the form — no more multipart parsing or server-side uploadFile() here.
 * This just re-verifies the object actually landed at that key before
 * trusting the client's claim (see verifyUploadedObject's own doc
 * comment for why that check exists).
 */
export async function parseBodyWithOptionalFile(
  req: Request,
  fileKeyField: string = "fileKey"
): Promise<{ body: any; fileKey?: string }> {
  const raw = await (req as any).json();
  const { [fileKeyField]: fileKey, ...body } = raw;
  if (fileKey) await verifyUploadedObject(fileKey);
  return { body, fileKey };
}
