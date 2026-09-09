/**
 * Global Search — Phase 5
 *
 * Searches students, companies, job roles, applications, and drives from one
 * query. Department-sensitive results (students, applications) are scoped to
 * the caller's own department for FACULTY/HOD — enforced here, not left to
 * the UI, mirroring how every other department-scoped read in this codebase
 * is enforced server-side.
 */

import { prisma } from "@/lib/prisma";

export interface SearchScope {
  role: string;
  /** Department id to restrict department-sensitive results to, or null for unrestricted (TP_ADMIN). */
  departmentId: string | null;
}

export async function resolveSearchScope(userId: string, role: string): Promise<SearchScope> {
  if (role === "FACULTY") {
    const profile = await prisma.facultyProfile.findUnique({ where: { userId }, select: { departmentId: true } });
    return { role, departmentId: profile?.departmentId ?? null };
  }
  if (role === "HOD") {
    const profile = await prisma.hodProfile.findUnique({ where: { userId }, select: { departmentId: true } });
    return { role, departmentId: profile?.departmentId ?? null };
  }
  // TP_ADMIN and anyone else with search:read see everything.
  return { role, departmentId: null };
}

export interface SearchResult {
  type: "student" | "company" | "jobRole" | "application" | "drive";
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

export async function globalSearch(query: string, scope: SearchScope): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const studentDeptFilter = scope.departmentId ? { branch: { departmentId: scope.departmentId } } : {};

  const [students, companies, jobRoles, applications, drives] = await Promise.all([
    prisma.student.findMany({
      where: {
        ...studentDeptFilter,
        OR: [
          { enrollmentNumber: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, enrollmentNumber: true, firstName: true, lastName: true, branch: { select: { code: true } } },
      take: 8,
    }),
    prisma.company.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, industry: true },
      take: 8,
    }),
    prisma.jobRole.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, driveId: true, drive: { select: { company: { select: { name: true } } } } },
      take: 8,
    }),
    prisma.application.findMany({
      where: {
        AND: [
          { student: studentDeptFilter },
          {
            OR: [
              { student: { enrollmentNumber: { contains: q, mode: "insensitive" } } },
              { jobRole: { title: { contains: q, mode: "insensitive" } } },
            ],
          },
        ],
      } as any,
      select: {
        id: true,
        status: true,
        student: { select: { enrollmentNumber: true, firstName: true, lastName: true } },
        jobRole: { select: { title: true, driveId: true } },
      },
      take: 8,
    }),
    prisma.placementDrive.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { company: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, title: true, academicYear: true, company: { select: { name: true } } },
      take: 8,
    }),
  ]);

  const results: SearchResult[] = [];

  for (const s of students) {
    results.push({
      type: "student",
      id: s.id,
      title: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber,
      subtitle: `${s.enrollmentNumber}${s.branch ? ` · ${s.branch.code}` : ""}`,
      link: `/admin/compliance/${s.id}`,
    });
  }
  for (const c of companies) {
    results.push({ type: "company", id: c.id, title: c.name, subtitle: c.industry, link: `/admin/companies` });
  }
  for (const r of jobRoles) {
    results.push({
      type: "jobRole",
      id: r.id,
      title: r.title,
      subtitle: r.drive.company.name,
      link: `/admin/drives/${r.driveId}`,
    });
  }
  for (const a of applications) {
    const name = [a.student.firstName, a.student.lastName].filter(Boolean).join(" ") || a.student.enrollmentNumber;
    results.push({
      type: "application",
      id: a.id,
      title: `${name} — ${a.jobRole.title}`,
      subtitle: a.status,
      link: `/admin/drives/${a.jobRole.driveId}`,
    });
  }
  for (const d of drives) {
    results.push({
      type: "drive",
      id: d.id,
      title: d.title,
      subtitle: `${d.company.name} · ${d.academicYear}`,
      link: `/admin/drives/${d.id}`,
    });
  }

  return results;
}
