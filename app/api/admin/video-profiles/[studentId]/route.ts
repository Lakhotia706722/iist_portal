import { NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/rbac/server-guard";
import { videoVerifySchema } from "@/lib/validations/profile";
import { adminVerifyVideoProfile } from "@/server/services/video-profile.service";

export async function POST(req: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const actor = await requirePermission("video:verify");
    const body = await req.json();
    const parsed = videoVerifySchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const vp = await adminVerifyVideoProfile(params.studentId, parsed.data, actor.id);
    return Response.json(vp);
  } catch (err) {
    return errorResponse(err);
  }
}
