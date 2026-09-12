import { NextRequest } from "next/server";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { achievementSchema } from "@/lib/validations/profile";
import { updateAchievement, deleteAchievement } from "@/server/services/achievement.service";
import { getStudentIdFromUserId, parseBodyWithOptionalFile } from "../../_helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    const { body, fileKey } = await parseBodyWithOptionalFile(req);
    const parsed = achievementSchema.partial().safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    return Response.json(await updateAchievement(params.id, studentId, parsed.data, actor.id, fileKey));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    await deleteAchievement(params.id, studentId, actor.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
