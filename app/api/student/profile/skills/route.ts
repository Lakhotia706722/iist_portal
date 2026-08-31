import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { prisma } from "@/lib/prisma";
import { studentSkillSchema, customSkillSchema } from "@/lib/validations/profile";
import {
  getStudentSkills,
  addStudentSkill,
  addCustomSkill,
} from "@/server/services/skill.service";

async function getStudentId(userId: string) {
  const s = await prisma.student.findUniqueOrThrow({ where: { userId }, select: { id: true } });
  return s.id;
}

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentId(actor.id);
    return Response.json(await getStudentSkills(studentId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const studentId = await getStudentId(actor.id);
    const body = await req.json();

    // Distinguish catalog skill vs custom skill by presence of skillId
    if (body.skillId) {
      const parsed = studentSkillSchema.safeParse(body);
      if (!parsed.success)
        return Response.json({ error: parsed.error.flatten() }, { status: 422 });
      const item = await addStudentSkill(studentId, parsed.data, actor.id);
      return Response.json(item, { status: 201 });
    } else {
      const parsed = customSkillSchema.safeParse(body);
      if (!parsed.success)
        return Response.json({ error: parsed.error.flatten() }, { status: 422 });
      const item = await addCustomSkill(studentId, parsed.data, actor.id);
      return Response.json(item, { status: 201 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}

