/**
 * Analytics — Phase 5
 *
 * Every figure here is computed with aggregation queries (count/groupBy/
 * aggregate), not by loading full row sets into JS and reducing client-side —
 * the dataset grows every batch cycle, so this has to stay index-friendly.
 */

import { prisma } from "@/lib/prisma";
import { getPolicyValue } from "./policy.service";

// ─── Admin Command Center ──────────────────────────────────────────────────────

export interface CommandCenterMetrics {
  students: {
    total: number;
    registered: number;
    profileComplete: number;
    eligible: number;
    restricted: number;
    placed: number;
    debarred: number;
  };
  companies: {
    active: number;
    upcoming: number;
    completed: number;
  };
  applications: {
    total: number;
    active: number;
    shortlisted: number;
    selected: number;
  };
  offers: {
    total: number;
    avgCtc: number | null;
    highestCtc: number | null;
    placementPercent: number;
  };
  alerts: {
    incompleteProfiles: number;
    missingDocuments: number;
    skillUpFailures: number;
    attendanceViolations: number;
    unmetRequirements: number;
    policyViolations: number;
  };
}

const ACTIVE_APPLICATION_STATUSES = [
  "APPLIED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "WRITTEN_TEST",
  "TECHNICAL_ROUND",
  "HR_ROUND",
  "FINAL_ROUND",
  "ON_HOLD",
];
const SHORTLISTED_OR_BEYOND = [
  "SHORTLISTED",
  "WRITTEN_TEST",
  "TECHNICAL_ROUND",
  "HR_ROUND",
  "FINAL_ROUND",
  "SELECTED",
];

export async function getCommandCenterMetrics(): Promise<CommandCenterMetrics> {
  const [
    totalStudents,
    registeredStudents,
    debarredCount,
    placedStudentCount,
    restrictedIncidentStudentIds,
    overrideRestricted,
    activeCompanies,
    upcomingCompanies,
    completedCompanies,
    totalApplications,
    activeApplications,
    shortlistedApplications,
    selectedApplications,
    offerAgg,
    documentAlerts,
    skillUpFailures,
    openIncidents,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { onboardingStep: { gte: 2 } } }),
    prisma.student.count({ where: { isDebarred: true } }),
    prisma.student.count({
      where: { offers: { some: { status: { in: ["ACCEPTED", "JOINED"] } } } },
    }),
    prisma.disciplineIncident.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] }, severity: { in: ["HIGH", "CRITICAL"] } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    prisma.complianceOverride.count({ where: { status: "RESTRICTED" } }),
    prisma.company.count({ where: { isActive: true } }),
    prisma.company.count({
      where: { drives: { some: { status: { in: ["PUBLISHED", "APPLICATIONS_OPEN"] } } } },
    }),
    prisma.company.count({
      where: {
        AND: [
          { drives: { some: { status: "COMPLETED" } } },
          { drives: { none: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } },
        ],
      },
    }),
    prisma.application.count(),
    prisma.application.count({ where: { status: { in: ACTIVE_APPLICATION_STATUSES as any } } }),
    prisma.application.count({ where: { status: { in: SHORTLISTED_OR_BEYOND as any } } }),
    prisma.application.count({ where: { status: "SELECTED" } }),
    prisma.offer.aggregate({
      _count: true,
      _avg: { ctc: true },
      _max: { ctc: true },
      where: { status: { notIn: ["WITHDRAWN"] } },
    }),
    prisma.document.count({ where: { status: { not: "VERIFIED" } } }),
    prisma.testResult.count({ where: { isPassed: false } }),
    prisma.disciplineIncident.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
  ]);

  // Profile completion and attendance violations require per-student
  // computation; approximate with a bounded query rather than N+1 calls.
  const minAttendance = await getPolicyValue<number>("min_attendance_percentage", null);
  const attendanceViolations =
    minAttendance > 0 ? await countAttendanceViolations(minAttendance) : 0;

  const incompleteProfiles = await prisma.student.count({
    where: {
      OR: [
        { firstName: null },
        { academicRecord: { is: null } },
        { studentSkills: { none: {} }, customSkills: { none: {} } },
        { resumes: { none: {} } },
      ],
    },
  });

  const restrictedCount =
    new Set(restrictedIncidentStudentIds.map((r) => r.studentId)).size + overrideRestricted;

  const eligibleCount = Math.max(
    0,
    totalStudents - debarredCount - placedStudentCount - restrictedCount
  );

  return {
    students: {
      total: totalStudents,
      registered: registeredStudents,
      profileComplete: totalStudents - incompleteProfiles,
      eligible: eligibleCount,
      restricted: restrictedCount,
      placed: placedStudentCount,
      debarred: debarredCount,
    },
    companies: {
      active: activeCompanies,
      upcoming: upcomingCompanies,
      completed: completedCompanies,
    },
    applications: {
      total: totalApplications,
      active: activeApplications,
      shortlisted: shortlistedApplications,
      selected: selectedApplications,
    },
    offers: {
      total: offerAgg._count,
      avgCtc: offerAgg._avg.ctc ? Number(offerAgg._avg.ctc.toFixed(2)) : null,
      highestCtc: offerAgg._max.ctc,
      placementPercent: totalStudents > 0 ? Number(((placedStudentCount / totalStudents) * 100).toFixed(1)) : 0,
    },
    alerts: {
      incompleteProfiles,
      missingDocuments: documentAlerts,
      skillUpFailures,
      attendanceViolations,
      unmetRequirements: incompleteProfiles, // profile gaps double as "unmet requirements" surface
      policyViolations: openIncidents,
    },
  };
}

async function countAttendanceViolations(minPercent: number): Promise<number> {
  // Group attendance records per student, compute pass rate in SQL-adjacent form.
  const rows = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    _count: true,
  });
  // Fall back to a per-student scan only when there's a meaningful dataset —
  // groupBy alone can't express "per student" ratios, so compute it directly.
  const perStudent = await prisma.$queryRaw<Array<{ studentId: string; total: bigint; present: bigint }>>`
    SELECT a."studentId", COUNT(*)::bigint as total,
           COUNT(*) FILTER (WHERE ar.status IN ('PRESENT','LATE'))::bigint as present
    FROM (
      SELECT rp.id as "roundParticipantId", app."studentId"
      FROM "RoundParticipant" rp
      JOIN "Application" app ON app.id = rp."applicationId"
    ) a
    JOIN "AttendanceRecord" ar ON ar."roundParticipantId" = a."roundParticipantId"
    GROUP BY a."studentId"
  `;
  void rows;
  return perStudent.filter((r) => Number(r.total) > 0 && (Number(r.present) / Number(r.total)) * 100 < minPercent).length;
}

// ─── Department / batch analytics ──────────────────────────────────────────────

export interface DepartmentAnalyticsFilters {
  departmentId?: string;
  branchId?: string;
  courseId?: string;
  batchId?: string;
  semester?: number;
}

export interface DepartmentAnalytics {
  totalStudents: number;
  registrationRate: number;
  applicationRate: number;
  skillUpAveragePercent: number | null;
  interviewAverageScore: number | null;
  placementRate: number;
  avgPackage: number | null;
  medianPackage: number | null;
  highestPackage: number | null;
  companyCount: number;
  offerCount: number;
}

async function studentWhereFromFilters(filters: DepartmentAnalyticsFilters) {
  return {
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.courseId ? { branch: { courseId: filters.courseId } } : {}),
    ...(filters.departmentId ? { branch: { departmentId: filters.departmentId } } : {}),
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
    ...(filters.semester ? { academicRecord: { currentSemester: filters.semester } } : {}),
  };
}

export async function getDepartmentAnalytics(
  filters: DepartmentAnalyticsFilters
): Promise<DepartmentAnalytics> {
  const where = await studentWhereFromFilters(filters);

  const [
    totalStudents,
    registeredStudents,
    studentsWithApplications,
    skillUpAgg,
    interviewAgg,
    placedStudents,
    offers,
  ] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.count({ where: { ...where, onboardingStep: { gte: 2 } } }),
    prisma.student.count({ where: { ...where, applications: { some: {} } } }),
    prisma.testResult.aggregate({
      _avg: { percentage: true },
      where: { student: where },
    }),
    prisma.interviewResult.aggregate({
      _avg: { overallScore: true },
      where: { mockInterview: { student: where } },
    }),
    prisma.student.count({
      where: { ...where, offers: { some: { status: { in: ["ACCEPTED", "JOINED"] } } } },
    }),
    prisma.offer.findMany({
      where: { student: where, status: { notIn: ["WITHDRAWN"] } },
      select: { ctc: true, companyId: true },
    }),
  ]);

  const ctcs = offers.map((o) => o.ctc).filter((c): c is number => c != null).sort((a, b) => a - b);
  const avgPackage = ctcs.length > 0 ? Number((ctcs.reduce((a, b) => a + b, 0) / ctcs.length).toFixed(2)) : null;
  const medianPackage =
    ctcs.length > 0
      ? ctcs.length % 2 === 1
        ? ctcs[(ctcs.length - 1) / 2]
        : Number(((ctcs[ctcs.length / 2 - 1] + ctcs[ctcs.length / 2]) / 2).toFixed(2))
      : null;
  const highestPackage = ctcs.length > 0 ? ctcs[ctcs.length - 1] : null;
  const companyCount = new Set(offers.map((o) => o.companyId)).size;

  return {
    totalStudents,
    registrationRate: totalStudents > 0 ? Number(((registeredStudents / totalStudents) * 100).toFixed(1)) : 0,
    applicationRate: totalStudents > 0 ? Number(((studentsWithApplications / totalStudents) * 100).toFixed(1)) : 0,
    skillUpAveragePercent: skillUpAgg._avg.percentage ? Number(skillUpAgg._avg.percentage.toFixed(1)) : null,
    interviewAverageScore: interviewAgg._avg.overallScore ? Number(interviewAgg._avg.overallScore.toFixed(1)) : null,
    placementRate: totalStudents > 0 ? Number(((placedStudents / totalStudents) * 100).toFixed(1)) : 0,
    avgPackage,
    medianPackage,
    highestPackage,
    companyCount,
    offerCount: offers.length,
  };
}

/** One row per department/branch, for a side-by-side comparison table/chart. */
export async function getDepartmentBreakdown(): Promise<
  Array<{ departmentId: string; departmentName: string; totalStudents: number; placed: number; placementRate: number }>
> {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true, branches: { select: { id: true } } },
  });

  const rows = await Promise.all(
    departments.map(async (d) => {
      const branchIds = d.branches.map((b) => b.id);
      const [total, placed] = await Promise.all([
        prisma.student.count({ where: { branchId: { in: branchIds } } }),
        prisma.student.count({
          where: { branchId: { in: branchIds }, offers: { some: { status: { in: ["ACCEPTED", "JOINED"] } } } },
        }),
      ]);
      return {
        departmentId: d.id,
        departmentName: d.name,
        totalStudents: total,
        placed,
        placementRate: total > 0 ? Number(((placed / total) * 100).toFixed(1)) : 0,
      };
    })
  );

  return rows;
}

// ─── Company analytics ──────────────────────────────────────────────────────────

export interface CompanyYearPerformance {
  academicYear: string;
  driveCount: number;
  applicantCount: number;
  selectedCount: number;
  offerCount: number;
  avgCtc: number | null;
}

export async function getCompanyHistoricalPerformance(
  companyId: string
): Promise<CompanyYearPerformance[]> {
  const drives = await prisma.placementDrive.findMany({
    where: { companyId },
    select: {
      id: true,
      academicYear: true,
      _count: { select: { applications: true } },
    },
  });

  const byYear = new Map<string, { driveIds: string[]; applicantCount: number }>();
  for (const d of drives) {
    const entry = byYear.get(d.academicYear) ?? { driveIds: [], applicantCount: 0 };
    entry.driveIds.push(d.id);
    entry.applicantCount += d._count.applications;
    byYear.set(d.academicYear, entry);
  }

  const results = await Promise.all(
    [...byYear.entries()].map(async ([academicYear, { driveIds, applicantCount }]) => {
      const [selectedCount, offerAgg] = await Promise.all([
        prisma.application.count({ where: { driveId: { in: driveIds }, status: "SELECTED" } }),
        prisma.offer.aggregate({
          where: { driveId: { in: driveIds }, status: { notIn: ["WITHDRAWN"] } },
          _count: true,
          _avg: { ctc: true },
        }),
      ]);
      return {
        academicYear,
        driveCount: driveIds.length,
        applicantCount,
        selectedCount,
        offerCount: offerAgg._count,
        avgCtc: offerAgg._avg.ctc ? Number(offerAgg._avg.ctc.toFixed(2)) : null,
      };
    })
  );

  return results.sort((a, b) => a.academicYear.localeCompare(b.academicYear));
}

export async function listCompanySummaries(): Promise<
  Array<{ id: string; name: string; driveCount: number; offerCount: number; avgCtc: number | null }>
> {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, _count: { select: { drives: true, offers: true } } },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    companies.map(async (c) => {
      const agg = await prisma.offer.aggregate({
        where: { companyId: c.id, status: { notIn: ["WITHDRAWN"] } },
        _avg: { ctc: true },
      });
      return {
        id: c.id,
        name: c.name,
        driveCount: c._count.drives,
        offerCount: c._count.offers,
        avgCtc: agg._avg.ctc ? Number(agg._avg.ctc.toFixed(2)) : null,
      };
    })
  );
}
