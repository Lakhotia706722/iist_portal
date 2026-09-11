/**
 * HOD Portal — Phase 7
 *
 * HOD already holds analytics:read / audit:read / compliance:read:all
 * unrestricted (same set as TP_ADMIN for these) — the gap this phase closes
 * isn't a missing permission, it's that HOD was reaching straight into
 * admin-owned pages/endpoints with no department scoping at all. Every
 * function here takes the caller's own departmentId (resolved once, server
 * side, from HodProfile — never a client-supplied value) and applies it as
 * a hard filter, the same `{ branch: { departmentId } }` shape already used
 * by search.service.ts's FACULTY/HOD scoping.
 */

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { getDepartmentAnalytics, type DepartmentAnalytics } from "./analytics.service";
import { getComplianceStatusBulk } from "./compliance.service";

export async function getDepartmentIdForHod(userId: string): Promise<string> {
  const profile = await prisma.hodProfile.findUnique({
    where: { userId },
    select: { departmentId: true },
  });
  if (!profile) {
    throw new ForbiddenError("No HOD profile found for this account");
  }
  return profile.departmentId;
}

export interface HodDashboard {
  department: { id: string; name: string };
  studentCounts: {
    total: number;
    registered: number;
    profileComplete: number;
    eligible: number;
    placed: number;
  };
  analytics: DepartmentAnalytics;
}

export async function getHodDashboard(departmentId: string): Promise<HodDashboard> {
  const department = await prisma.department.findUniqueOrThrow({
    where: { id: departmentId },
    select: { id: true, name: true },
  });

  const studentWhere = { branch: { departmentId } };
  const [total, registered, incompleteCount, placed, analytics] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.student.count({ where: { ...studentWhere, onboardingStep: { gte: 2 } } }),
    prisma.student.count({
      where: {
        ...studentWhere,
        OR: [{ firstName: null }, { academicRecord: { is: null } }, { resumes: { none: {} } }],
      },
    }),
    prisma.student.count({
      where: { ...studentWhere, offers: { some: { status: { in: ["ACCEPTED", "JOINED"] } } } },
    }),
    getDepartmentAnalytics({ departmentId }),
  ]);

  return {
    department,
    studentCounts: {
      total,
      registered,
      profileComplete: total - incompleteCount,
      eligible: Math.max(0, total - placed),
      placed,
    },
    analytics,
  };
}

// ─── Department students ───────────────────────────────────────────────────

export interface DepartmentStudentFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listDepartmentStudents(departmentId: string, filters: DepartmentStudentFilters = {}) {
  const where = {
    branch: { departmentId },
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
        testResults: { select: { percentage: true }, orderBy: { createdAt: "desc" }, take: 1 },
        applications: { select: { id: true, status: true } },
        offers: { select: { id: true, status: true } },
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
      latestSkillUpPercent: s.testResults[0]?.percentage ?? null,
      applicationCount: s.applications.length,
      shortlistedCount: s.applications.filter((a) =>
        ["SHORTLISTED", "WRITTEN_TEST", "TECHNICAL_ROUND", "HR_ROUND", "FINAL_ROUND", "SELECTED"].includes(a.status)
      ).length,
      isPlaced: s.offers.some((o) => o.status === "ACCEPTED" || o.status === "JOINED"),
    })),
    total,
  };
}

// ─── Department compliance ─────────────────────────────────────────────────

export async function getDepartmentCompliance(departmentId: string) {
  const students = await prisma.student.findMany({
    where: { branch: { departmentId } },
    select: { id: true, enrollmentNumber: true, firstName: true, lastName: true },
  });

  const statusMap = await getComplianceStatusBulk(students.map((s) => s.id));

  return students.map((s) => ({
    studentId: s.id,
    name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber,
    enrollmentNumber: s.enrollmentNumber,
    compliance: statusMap.get(s.id) ?? null,
  }));
}
