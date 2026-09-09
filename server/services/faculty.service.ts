/**
 * Faculty Portal — Phase 7
 *
 * Faculty already hold student:read:all / skillup:write / interview:write
 * etc. (unrestricted, same as HOD/TP_ADMIN) — this service doesn't change
 * what they can see, it gives them a real home base: their own created
 * tests/interviews with counts, and a department-scoped "needs attention"
 * list. The assigned-students view is read-only by construction (no write
 * functions here) even though their permissions would technically allow
 * more — this phase doesn't grant faculty any new write capability.
 */

import { prisma } from "@/lib/prisma";

async function getFacultyDepartmentId(userId: string): Promise<string | null> {
  const profile = await prisma.facultyProfile.findUnique({
    where: { userId },
    select: { departmentId: true },
  });
  return profile?.departmentId ?? null;
}

export interface FacultyDashboard {
  departmentId: string | null;
  tests: Array<{
    id: string;
    title: string;
    status: string;
    scheduledAt: Date;
    participantCount: number;
    completedCount: number;
  }>;
  interviews: Array<{
    id: string;
    studentName: string;
    scheduledAt: Date;
    status: string;
    type: string;
  }>;
  needsAttention: Array<{
    studentId: string;
    name: string;
    enrollmentNumber: string;
    reason: string;
  }>;
}

export async function getFacultyDashboard(userId: string): Promise<FacultyDashboard> {
  const departmentId = await getFacultyDepartmentId(userId);
  const studentWhere = departmentId ? { branch: { departmentId } } : {};

  const [tests, interviews] = await Promise.all([
    prisma.test.findMany({
      where: { createdById: userId },
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        _count: { select: { participants: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 10,
    }),
    prisma.mockInterview.findMany({
      where: { createdById: userId },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        type: true,
        student: { select: { firstName: true, lastName: true, enrollmentNumber: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 10,
    }),
  ]);

  const testCompletion = await Promise.all(
    tests.map((t) => prisma.testResult.count({ where: { testId: t.id } }))
  );

  const needsAttention = await getStudentsNeedingAttention(studentWhere, 10);

  return {
    departmentId,
    tests: tests.map((t, i) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      scheduledAt: t.scheduledAt,
      participantCount: t._count.participants,
      completedCount: testCompletion[i],
    })),
    interviews: interviews.map((iv) => ({
      id: iv.id,
      studentName:
        [iv.student.firstName, iv.student.lastName].filter(Boolean).join(" ") ||
        iv.student.enrollmentNumber,
      scheduledAt: iv.scheduledAt,
      status: iv.status,
      type: iv.type,
    })),
    needsAttention,
  };
}

/**
 * Students with no SkillUp result yet, a low score, or no mock interview —
 * scoped to whatever population the caller actually teaches (their
 * department, or everyone if they have no FacultyProfile.departmentId set).
 */
async function getStudentsNeedingAttention(
  studentWhere: Record<string, unknown>,
  limit: number
) {
  const [noSkillUp, noInterview] = await Promise.all([
    prisma.student.findMany({
      where: { ...studentWhere, testResults: { none: {} } },
      select: { id: true, firstName: true, lastName: true, enrollmentNumber: true },
      take: limit,
    }),
    prisma.student.findMany({
      where: { ...studentWhere, mockInterviews: { none: {} } },
      select: { id: true, firstName: true, lastName: true, enrollmentNumber: true },
      take: limit,
    }),
  ]);

  const seen = new Set<string>();
  const results: FacultyDashboard["needsAttention"] = [];
  for (const s of noSkillUp) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    results.push({
      studentId: s.id,
      name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber,
      enrollmentNumber: s.enrollmentNumber,
      reason: "No SkillUp result yet",
    });
    if (results.length >= limit) return results;
  }
  for (const s of noInterview) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    results.push({
      studentId: s.id,
      name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber,
      enrollmentNumber: s.enrollmentNumber,
      reason: "No mock interview scheduled",
    });
    if (results.length >= limit) return results;
  }
  return results;
}

// ─── Assigned students (read-only) ─────────────────────────────────────────

export interface AssignedStudentFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listAssignedStudents(userId: string, filters: AssignedStudentFilters = {}) {
  const departmentId = await getFacultyDepartmentId(userId);
  const where = {
    ...(departmentId ? { branch: { departmentId } } : {}),
    ...(filters.search
      ? {
          OR: [
            { enrollmentNumber: { contains: filters.search, mode: "insensitive" as const } },
            { firstName: { contains: filters.search, mode: "insensitive" as const } },
            { lastName: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: {
        id: true,
        enrollmentNumber: true,
        firstName: true,
        lastName: true,
        branch: { select: { name: true, code: true } },
        batch: { select: { name: true } },
        testResults: { select: { percentage: true, isPassed: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { mockInterviews: true } },
      },
      orderBy: { enrollmentNumber: "asc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.student.count({ where }),
  ]);

  return {
    students: students.map((s) => ({
      id: s.id,
      name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber,
      enrollmentNumber: s.enrollmentNumber,
      branch: s.branch,
      batch: s.batch,
      latestSkillUp: s.testResults[0] ?? null,
      mockInterviewCount: s._count.mockInterviews,
    })),
    total,
  };
}
