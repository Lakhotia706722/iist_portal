import { NextRequest } from "next/server";
import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { personalInfoSchema } from "@/lib/validations/student";
import { savePersonalInfo } from "@/server/services/student.service";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("STUDENT");
    const body = await req.json();
    const parsed = personalInfoSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });

    const student = await prisma.student.findUniqueOrThrow({
      where: { userId: actor.id },
    });

    const result = await savePersonalInfo(student.id, parsed.data, actor.id);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
