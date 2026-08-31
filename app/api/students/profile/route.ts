import { requireRole, errorResponse } from "@/lib/rbac/server-guard";
import { getStudentProfile } from "@/server/services/student.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireRole("STUDENT");
    const student = await prisma.student.findUniqueOrThrow({
      where: { userId: actor.id },
    });
    const profile = await getStudentProfile(student.id);
    return Response.json(profile);
  } catch (err) {
    return errorResponse(err);
  }
}
