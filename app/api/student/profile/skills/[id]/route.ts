import { NextRequest } from "next/server";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { prisma } from "@/lib/prisma";
import { studentSkillSchema, customSkillSchema } from "@/lib/validations/profile";
import {
  updateStudentSkill,
  removeStudentSkill,
  updateCustomSkill,
  removeCustomSkill,
} from "@/server/services/skill.service";

async function getStudentId(userId: string) {
  const s = await prisma.student.findUniqueOrThrow({ where: { userId }, select: { id: true } });
  return s.id;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentId(actor.id);
    const body = await req.json();

    if (body.skillId !== undefined) {
      // catalog skill update
      const parsed = studentSkillSchema.partial().safeParse(body);
      if (!parsed.success)
        return Response.json({ error: parsed.error.flatten() }, { status: 422 });
      return Response.json(await updateStudentSkill(params.id, studentId, parsed.data, actor.id));
    } else {
      // custom skill update
      const parsed = customSkillSchema.partial().safeParse(body);
      if (!parsed.success)
        return Response.json({ error: parsed.error.flatten() }, { status: 422 });
      return Response.json(await updateCustomSkill(params.id, studentId, parsed.data, actor.id));
    }
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentId(actor.id);
    const { searchParams } = req.nextUrl;
    const isCustom = searchParams.get("custom") === "true";

    if (isCustom) {
      await removeCustomSkill(params.id, studentId, actor.id);
    } else {
      await removeStudentSkill(params.id, studentId, actor.id);
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
