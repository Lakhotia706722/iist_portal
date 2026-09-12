import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { videoProfileSchema } from "@/lib/validations/profile";
import { getVideoProfile, upsertVideoProfile } from "@/server/services/video-profile.service";
import { getStudentIdFromUserId } from "../_helpers";
import { verifyUploadedObject } from "@/lib/uploads/presign";

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    const vp = await getVideoProfile(studentId);
    return Response.json(vp ?? { status: "NOT_UPLOADED" });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    // Phase 16 — P5: the client uploads the video directly to storage
    // (see hooks/use-direct-upload.ts) — type/size were already validated
    // by /api/uploads/presign before the upload URL was issued, so no
    // second check is needed here beyond confirming the object exists.
    const { videoKey, ...body } = await req.json();
    if (videoKey) await verifyUploadedObject(videoKey);

    const parsed = videoProfileSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });

    const vp = await upsertVideoProfile(studentId, parsed.data, actor.id, videoKey);
    return Response.json(vp);
  } catch (err) {
    return errorResponse(err);
  }
}

