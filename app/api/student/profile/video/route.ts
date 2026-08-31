import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { videoProfileSchema } from "@/lib/validations/profile";
import { getVideoProfile, upsertVideoProfile } from "@/server/services/video-profile.service";
import { getStudentIdFromUserId, uploadFile } from "../_helpers";

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
    const contentType = req.headers.get("content-type") ?? "";

    let body: any;
    let videoKey: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = JSON.parse((formData.get("data") as string) ?? "{}");
      const file = formData.get("video") as File | null;
      if (file) {
        // Validate file type and size server-side
        const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
        if (!allowedTypes.includes(file.type)) {
          return Response.json(
            { error: "Only MP4, WebM and MOV video files are allowed" },
            { status: 422 }
          );
        }
        const maxBytes = 100 * 1024 * 1024; // 100 MB
        if (file.size > maxBytes) {
          return Response.json({ error: "Video file must be under 100 MB" }, { status: 422 });
        }
        videoKey = await uploadFile(file, "videos", studentId);
      }
    } else {
      body = await req.json();
    }

    const parsed = videoProfileSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });

    const vp = await upsertVideoProfile(studentId, parsed.data, actor.id, videoKey);
    return Response.json(vp);
  } catch (err) {
    return errorResponse(err);
  }
}

