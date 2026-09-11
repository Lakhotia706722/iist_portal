import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { achievementSchema } from "@/lib/validations/profile";
import { getAchievements, createAchievement } from "@/server/services/achievement.service";
import { getStudentIdFromUserId, parseBodyWithOptionalFile } from "../_helpers";

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    return Response.json(await getAchievements(studentId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentIdFromUserId(actor.id);
    const { body, fileKey } = await parseBodyWithOptionalFile(req, "certificate", "achievements", studentId);
    const parsed = achievementSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    const item = await createAchievement(studentId, parsed.data, actor.id, fileKey);
    return Response.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

