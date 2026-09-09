import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/rbac/server-guard";

/**
 * Resolve the Student.id for a given User.id.
 *
 * Session claims carry `studentId`, but it is only populated at login time —
 * always resolve through this helper so routes never confuse User.id with
 * Student.id (the two are distinct cuids and silently "work" as strings).
 */
export async function getStudentIdFromUserId(userId: string): Promise<string> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) throw new ForbiddenError("No student record for this account");
  return student.id;
}
