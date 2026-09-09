/**
 * Shortlist Service — Phase 3
 *
 * Bulk shortlisting operations with CSV upload support,
 * filtering, and batch status updates for applications.
 */

import { prisma } from "@/lib/prisma";
import { BulkShortlistInput, CsvShortlistInput } from "@/lib/validations/placement";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { PlacementNotifications } from "@/lib/notifications";
import { ApplicationStatus } from "@prisma/client";
import { writeAuditLog } from "./audit.service";
import { getStorageAdapter } from "@/lib/storage";

export type ShortlistableApplication = {
  id: string;
  status: string;
  appliedAt: Date;
  student: {
    id: string;
    enrollmentNumber: string;
    firstName: string | null;
    lastName: string | null;
    user: { email: string };
    batch: {
      academicYear: string;
      branch: {
        code: string;
        name: string;
      };
    };
    academicRecord: {
      currentCgpa: number | null;
      currentSemester: number | null;
      activeBacklogs: number | null;
      totalBacklogs: number | null;
      tenthPercentage: number | null;
      twelfthPercentage: number | null;
    } | null;
  };
  jobRole: {
    id: string;
    title: string;
    ctcMin: number | null;
    ctcMax: number | null;
  };
  resumeVersion: {
    fileKey: string | null;
    fileUrl: string | null;
  } | null;
};

export type ShortlistFilters = {
  jobRoleId?: string;
  status?: string;
  batchYear?: string;
  branchCode?: string;
  courseCode?: string;
  minCgpa?: number;
  maxCgpa?: number;
  gender?: string;
  category?: string;
  search?: string; // Name/enrollment number
  limit?: number;
  offset?: number;
  sortBy?: "appliedAt" | "cgpa" | "name" | "enrollmentNumber";
  sortOrder?: "asc" | "desc";
};

// ─── List Shortlistable Applications ──────────────────────────────────────────

export async function listShortlistableApplications(
  driveId: string,
  filters: ShortlistFilters = {}
): Promise<{
  applications: ShortlistableApplication[];
  total: number;
  stats: {
    byStatus: Record<string, number>;
    byJobRole: Record<string, number>;
    byBranch: Record<string, number>;
    avgCgpa: number;
  };
}> {
  const where: any = {
    jobRole: { driveId },
    status: { in: ["APPLIED", "UNDER_REVIEW"] }, // Only shortlistable statuses
  };

  // Apply filters
  if (filters.jobRoleId) {
    where.jobRoleId = filters.jobRoleId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    where.OR = [
      { student: { firstName: { contains: filters.search, mode: "insensitive" } } },
      { student: { lastName: { contains: filters.search, mode: "insensitive" } } },
      { student: { enrollmentNumber: { contains: filters.search, mode: "insensitive" } } },
      { student: { email: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  if (filters.batchYear) {
    where.student = { ...where.student, batch: { academicYear: filters.batchYear } };
  }

  if (filters.branchCode) {
    where.student = {
      ...where.student,
      batch: { ...where.student?.batch, branch: { code: filters.branchCode } }
    };
  }

  if (filters.minCgpa || filters.maxCgpa) {
    where.student = {
      ...where.student,
      academicRecord: {
        ...(filters.minCgpa && { currentCgpa: { gte: filters.minCgpa } }),
        ...(filters.maxCgpa && { currentCgpa: { lte: filters.maxCgpa } }),
      }
    };
  }

  if (filters.gender) {
    where.student = { ...where.student, gender: filters.gender };
  }

  if (filters.category) {
    where.student = { ...where.student, category: filters.category };
  }

  // Determine sort order
  const orderBy: any = {};
  switch (filters.sortBy) {
    case "cgpa":
      orderBy.student = { academicRecord: { currentCgpa: filters.sortOrder || "desc" } };
      break;
    case "name":
      orderBy.student = { firstName: filters.sortOrder || "asc" };
      break;
    case "enrollmentNumber":
      orderBy.student = { enrollmentNumber: filters.sortOrder || "asc" };
      break;
    default:
      orderBy.appliedAt = filters.sortOrder || "desc";
  }

  const [applications, total, statusStats, roleStats, branchApplications] = await Promise.all([
    prisma.application.findMany({
      where,
      select: {
        id: true,
        status: true,
        appliedAt: true,
        student: {
          select: {
            id: true,
            enrollmentNumber: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true } },
            batch: {
              select: {
                academicYear: true,
                branch: { select: { code: true, name: true } },
              },
            },
            academicRecord: {
              select: {
                currentCgpa: true,
                currentSemester: true,
                activeBacklogs: true,
                totalBacklogs: true,
                tenthPercentage: true,
                twelfthPercentage: true,
              },
            },
          },
        },
        jobRole: {
          select: {
            id: true,
            title: true,
            ctcMin: true,
            ctcMax: true,
          },
        },
        resumeVersion: {
          select: {
            fileKey: true,
          },
        },
      },
      orderBy,
      skip: filters.offset || 0,
      take: filters.limit || 100,
    }),
    prisma.application.count({ where }),
    // Stats
    prisma.application.groupBy({
      by: ["status"],
      where: { jobRole: { driveId } },
      _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ["jobRoleId"],
      where: { jobRole: { driveId } },
      _count: { _all: true },
    }),
    prisma.application.findMany({
      where: { jobRole: { driveId } },
      select: {
        student: {
          select: {
            batch: { select: { branch: { select: { code: true } } } },
            academicRecord: { select: { currentCgpa: true } },
          },
        },
      },
    }),
  ]);

  // Process branch stats & calculate average CGPA
  const branchStats = branchApplications.reduce((acc: Record<string, number>, app) => {
    const branch = app.student.batch?.branch?.code || "Unknown";
    acc[branch] = (acc[branch] || 0) + 1;
    return acc;
  }, {});

  const cgpaValues = branchApplications
    .map(app => app.student.academicRecord?.currentCgpa)
    .filter((cgpa): cgpa is number => cgpa !== null);
  
  const avgCgpa = cgpaValues.length > 0
    ? cgpaValues.reduce((sum, cgpa) => sum + cgpa, 0) / cgpaValues.length
    : 0;

  const storage = getStorageAdapter();
  const applicationsWithResumeUrls: ShortlistableApplication[] = await Promise.all(
    applications.map(async (app) => ({
      ...app,
      resumeVersion: app.resumeVersion
        ? {
            fileKey: app.resumeVersion.fileKey,
            fileUrl: app.resumeVersion.fileKey ? await storage.getSignedUrl(app.resumeVersion.fileKey) : null,
          }
        : null,
    }))
  );

  return {
    applications: applicationsWithResumeUrls,
    total,
    stats: {
      byStatus: statusStats.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count._all }),
        {}
      ),
      byJobRole: roleStats.reduce(
        (acc, item) => ({ ...acc, [item.jobRoleId]: item._count._all }),
        {}
      ),
      byBranch: branchStats,
      avgCgpa: avgCgpa,
    },
  };
}

// ─── Bulk Shortlist Actions ───────────────────────────────────────────────────

export async function bulkShortlistApplications(
  data: BulkShortlistInput,
  changedById?: string
): Promise<{
  updated: number;
  failed: Array<{ applicationId: string; reason: string }>;
}> {
  // Validate all applications exist and are in shortlistable status
  const applications = await prisma.application.findMany({
    where: {
      id: { in: data.applicationIds },
      status: { in: ["APPLIED", "UNDER_REVIEW"] },
    },
    include: {
      student: { select: { id: true } },
      jobRole: {
        include: {
          drive: { include: { company: true } },
        },
      },
    },
  });

  const validIds = applications.map(app => app.id);
  const invalidIds = data.applicationIds.filter(id => !validIds.includes(id));

  if (validIds.length === 0) {
    throw new ValidationError("No valid applications found for shortlisting");
  }

  // Determine target status
  const newStatus: ApplicationStatus = data.action === "SHORTLISTED" ? ApplicationStatus.SHORTLISTED : ApplicationStatus.REJECTED;

  // Perform bulk update
  const updateResult = await prisma.$transaction(async (tx) => {
    await tx.application.updateMany({
      where: { id: { in: validIds } },
      data: { status: newStatus },
    });

    const statusHistoryData = validIds.map(applicationId => ({
      applicationId,
      toStatus: newStatus,
      note: data.note || `Bulk ${data.action.toLowerCase()} action`,
    }));

    await tx.applicationStatusHistory.createMany({ data: statusHistoryData });

    return { updated: validIds.length };
  });

  // Send notifications
  try {
    const notificationPromises = applications.map(app => {
      if (newStatus === "SHORTLISTED") {
        return PlacementNotifications.shortlisted(
          app.student.id,
          app.jobRole.drive.company.name,
          app.jobRole.title
        );
      } else {
        return PlacementNotifications.rejected(
          app.student.id,
          app.jobRole.drive.company.name,
          app.jobRole.title
        );
      }
    });

    await Promise.allSettled(notificationPromises);
  } catch (error) {
    console.warn("Bulk shortlist notifications failed:", error);
  }

  await writeAuditLog({
    userId: changedById,
    action: "STATUS_CHANGE",
    entity: "Application",
    newValues: { status: newStatus },
    metadata: {
      operation: "bulkShortlist",
      action: data.action,
      applicationIds: validIds,
      updated: updateResult.updated,
      skipped: invalidIds,
      note: data.note ?? null,
    },
  });

  return {
    updated: updateResult.updated,
    failed: invalidIds.map(id => ({
      applicationId: id,
      reason: "Application not found or not in shortlistable status",
    })),
  };
}

// ─── CSV-based Shortlisting ───────────────────────────────────────────────────

// Phase 10: rewritten to match the CSV-upload panel's own documented
// per-row format (enrollmentNumber, action, optional note) — see the
// comment on csvShortlistSchema for what was wrong before. Applications
// are matched by enrollment number *within this drive*, across whichever
// job role they applied to (the CSV has no jobRoleId column), since a
// student can only have one shortlistable application per drive in the
// common case; the rare case of more than one is treated as ambiguous
// and reported back as a failed row rather than guessed at.
export async function shortlistFromCsv(
  driveId: string,
  data: CsvShortlistInput,
  changedById?: string
): Promise<{
  processed: number;
  shortlisted: number;
  rejected: number;
  failed: Array<{ enrollmentNumber: string; reason: string }>;
}> {
  const enrollmentNumbers = data.rows.map(r => r.enrollmentNumber);

  const applications = await prisma.application.findMany({
    where: {
      jobRole: { driveId },
      student: { enrollmentNumber: { in: enrollmentNumbers } },
      status: { in: ["APPLIED", "UNDER_REVIEW"] },
    },
    include: {
      student: { select: { id: true, enrollmentNumber: true } },
      jobRole: { include: { drive: { include: { company: true } } } },
    },
  });

  // Group matches by enrollment number to detect the ambiguous case.
  const byEnrollment = new Map<string, typeof applications>();
  for (const app of applications) {
    const list = byEnrollment.get(app.student.enrollmentNumber) ?? [];
    list.push(app);
    byEnrollment.set(app.student.enrollmentNumber, list);
  }

  const failed: Array<{ enrollmentNumber: string; reason: string }> = [];
  const shortlistIds: string[] = [];
  const rejectIds: string[] = [];
  // application -> the row's action, kept for per-row notes/notifications
  const resolved: Array<{ app: (typeof applications)[number]; action: "SHORTLISTED" | "REJECTED"; note?: string }> = [];

  for (const row of data.rows) {
    const matches = byEnrollment.get(row.enrollmentNumber);
    if (!matches || matches.length === 0) {
      failed.push({ enrollmentNumber: row.enrollmentNumber, reason: "No shortlistable application found for this enrollment number in this drive" });
      continue;
    }
    if (matches.length > 1) {
      failed.push({ enrollmentNumber: row.enrollmentNumber, reason: "Multiple applications found for this enrollment number in this drive — use the bulk selection UI instead" });
      continue;
    }
    const app = matches[0];
    (row.action === "SHORTLISTED" ? shortlistIds : rejectIds).push(app.id);
    resolved.push({ app, action: row.action, note: row.note || undefined });
  }

  if (resolved.length === 0) {
    throw new ValidationError("No valid applications found for the provided rows");
  }

  await prisma.$transaction(async (tx) => {
    if (shortlistIds.length > 0) {
      await tx.application.updateMany({
        where: { id: { in: shortlistIds } },
        data: { status: ApplicationStatus.SHORTLISTED },
      });
    }
    if (rejectIds.length > 0) {
      await tx.application.updateMany({
        where: { id: { in: rejectIds } },
        data: { status: ApplicationStatus.REJECTED },
      });
    }

    await tx.applicationStatusHistory.createMany({
      data: resolved.map(({ app, action, note }) => ({
        applicationId: app.id,
        toStatus: action === "SHORTLISTED" ? ApplicationStatus.SHORTLISTED : ApplicationStatus.REJECTED,
        note: note || "Updated via CSV upload",
      })),
    });
  });

  // Send notifications
  try {
    const notificationPromises = resolved.map(({ app, action }) =>
      action === "SHORTLISTED"
        ? PlacementNotifications.shortlisted(app.student.id, app.jobRole.drive.company.name, app.jobRole.title)
        : PlacementNotifications.rejected(app.student.id, app.jobRole.drive.company.name, app.jobRole.title)
    );

    await Promise.allSettled(notificationPromises);
  } catch (error) {
    console.warn("CSV shortlist notifications failed:", error);
  }

  await writeAuditLog({
    userId: changedById,
    action: "STATUS_CHANGE",
    entity: "Application",
    newValues: { status: "MIXED" },
    metadata: {
      operation: "shortlistFromCsv",
      driveId,
      processed: data.rows.length,
      shortlisted: shortlistIds.length,
      rejected: rejectIds.length,
      failed,
    },
  });

  return {
    processed: data.rows.length,
    shortlisted: shortlistIds.length,
    rejected: rejectIds.length,
    failed,
  };
}

// ─── Shortlist Statistics ─────────────────────────────────────────────────────

export async function getShortlistStats(driveId: string): Promise<{
  totalApplications: number;
  shortlisted: number;
  rejected: number;
  pending: number;
  shortlistRate: number;
  byJobRole: Record<string, {
    total: number;
    shortlisted: number;
    rejected: number;
    rate: number;
  }>;
}> {
  const [totalStats, roleStats] = await Promise.all([
    prisma.application.groupBy({
      by: ["status"],
      where: { jobRole: { driveId } },
      _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ["jobRoleId", "status"],
      where: { jobRole: { driveId } },
      _count: { _all: true },
    }),
  ]);

  const statusCounts = totalStats.reduce(
    (acc, item) => ({ ...acc, [item.status]: item._count._all }),
    {} as Record<string, number>
  );

  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const shortlisted = statusCounts.SHORTLISTED || 0;
  const rejected = statusCounts.REJECTED || 0;
  const pending = (statusCounts.APPLIED || 0) + (statusCounts.UNDER_REVIEW || 0);

  // Process by job role
  const byJobRole: Record<string, any> = {};
  roleStats.forEach(item => {
    if (!byJobRole[item.jobRoleId]) {
      byJobRole[item.jobRoleId] = {
        total: 0,
        shortlisted: 0,
        rejected: 0,
        rate: 0,
      };
    }
    
    byJobRole[item.jobRoleId].total += item._count._all;
    
    if (item.status === "SHORTLISTED") {
      byJobRole[item.jobRoleId].shortlisted = item._count._all;
    } else if (item.status === "REJECTED") {
      byJobRole[item.jobRoleId].rejected = item._count._all;
    }
  });

  // Calculate rates
  Object.values(byJobRole).forEach((stats: any) => {
    stats.rate = stats.total > 0 ? (stats.shortlisted / stats.total) * 100 : 0;
  });

  return {
    totalApplications: total,
    shortlisted,
    rejected,
    pending,
    shortlistRate: total > 0 ? (shortlisted / total) * 100 : 0,
    byJobRole,
  };
}

// ─── Export Functions ─────────────────────────────────────────────────────────

export async function exportShortlistData(
  driveId: string,
  filters: ShortlistFilters = {}
): Promise<{
  filename: string;
  data: Array<{
    enrollmentNumber: string;
    name: string;
    email: string;
    branch: string;
    batch: string;
    cgpa: number | null;
    status: string;
    jobRole: string;
    appliedAt: string;
  }>;
}> {
  const { applications } = await listShortlistableApplications(driveId, {
    ...filters,
    limit: 10000, // Export all matching records
  });

  const exportData = applications.map(app => ({
    enrollmentNumber: app.student.enrollmentNumber,
    name: `${app.student.firstName} ${app.student.lastName}`,
    email: app.student.user.email,
    branch: app.student.batch.branch.code,
    batch: app.student.batch.academicYear,
    cgpa: app.student.academicRecord?.currentCgpa || null,
    status: app.status,
    jobRole: app.jobRole.title,
    appliedAt: app.appliedAt.toISOString(),
  }));

  return {
    filename: `shortlist-${driveId}-${new Date().toISOString().split('T')[0]}.csv`,
    data: exportData,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export async function validateShortlistEligibility(
  applicationIds: string[]
): Promise<{
  eligible: string[];
  ineligible: Array<{ applicationId: string; reason: string }>;
}> {
  const applications = await prisma.application.findMany({
    where: { id: { in: applicationIds } },
    select: {
      id: true,
      status: true,
      jobRole: {
        select: {
          drive: { select: { status: true } },
        },
      },
    },
  });

  const eligible: string[] = [];
  const ineligible: Array<{ applicationId: string; reason: string }> = [];

  applicationIds.forEach(id => {
    const app = applications.find(a => a.id === id);
    
    if (!app) {
      ineligible.push({ applicationId: id, reason: "Application not found" });
      return;
    }

    if (!["APPLIED", "UNDER_REVIEW"].includes(app.status)) {
      ineligible.push({
        applicationId: id,
        reason: `Application status is ${app.status}, not shortlistable`
      });
      return;
    }

    if (!["APPLICATIONS_CLOSED", "ONGOING"].includes(app.jobRole.drive.status)) {
      ineligible.push({
        applicationId: id,
        reason: `Drive status is ${app.jobRole.drive.status}, shortlisting not allowed`
      });
      return;
    }

    eligible.push(id);
  });

  return { eligible, ineligible };
}