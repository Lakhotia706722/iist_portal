/**
 * Direct-to-storage upload — step 1 of 3 — Phase 16, P5.
 * POST { category, fileName, mimeType, sizeBytes, targetId? } ->
 * { key, uploadUrl, requiredContentType }
 *
 * Flow: (1) client calls this to get a presigned PUT URL, scoped and
 * validated per category (see lib/uploads/presign.ts) — (2) client PUTs
 * the file bytes directly to `uploadUrl` (R2/S3 in production; this app's
 * own /api/uploads/local-put in local dev), never touching a Next.js
 * route for the bytes themselves — (3) client calls the category's
 * existing confirm endpoint (e.g. POST /api/student/resumes/:id/versions)
 * with `{ key }` instead of multipart file bytes, which now writes the
 * key into the DB row after verifying the object really exists (see
 * verifyUploadedObject()).
 */
import { NextRequest, NextResponse } from "next/server";
import { createPresignedUpload } from "@/lib/uploads/presign";
import { handleApiError } from "@/lib/api-utils";
import { ValidationError } from "@/lib/errors";
import { z } from "zod";

const presignRequestSchema = z.object({
  category: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  targetId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = presignRequestSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError(parsed.error.issues.map((i) => i.message).join("; "));
    const result = await createPresignedUpload(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
