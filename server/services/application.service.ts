/**
 * Application Service — Phase 3
 *
 * Student application lifecycle with:
 * - Eligibility re-check at apply time (gate)
 * - Resume snapshot for version consistency
 * - Auto-close after deadline
 * - Status history tracking
 */

import { prisma } from "@/lib/prisma";
import { ApplyInput, ApplicationStatusInput } from "@/lib/validations/placement";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { evaluateEligibility } from "@/lib/eligibility-engine";
import { writeAuditLog } from "./audit.service";
import { PlacementNotifications, AdminNotifications } from "@/lib/notifications";
import { ApplicationStatus } from "@prisma/client";
import { getPolicyValue } from "./policy.service";
import { getStorageAdapter } from "@/lib/storage";

export type ApplicationWithDetails = {
  id: string;
  studentId: string;
  jobRoleId: string;
  resumeVersionId: string | null;
  status: string;
  appliedAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    enrollmentNumber: string;
    firstName: string | null;
    lastName: string | null;
    batch: {
      academicYear: string;
      branch: { code: string; name: string };
    };
    academicRecord: {
      currentCgpa: number | null;
      currentSemester: number | null;
    } | null;
  };
  jobRole: {
    id: string;
    title: string;
    ctcMin: number | null;
    ctcMax: number | null;
    drive: {
      id: string;
      title: string;
      status: string;
      company: { name: string; logoKey: string | null };
    };
  };
  resumeVersion: {
    id: string;
    fileKey: string | null;
    createdAt: Date;
  } | null;
  statusHistory: Array<{
    id: string;
    toStatus: string;
    note: string | null;
    createdAt: Date;
    changedById: string | null;
  }>;
  /** Average SkillUp test percentage across all categories, if any results exist. */
  skillUpAverage?: number | null;
};

export type StudentApplicationSummary = {
  id: string;
  status: string;
  appliedAt: Date;
  jobRole: {
    title: string;
    ctcMin: number | null;
    ctcMax: number | null;
  };
  company: { name: string; logoKey: string | null; logoUrl: string | null };
  drive: { title: string; status: string };
  currentRound?: { title: string; scheduledAt: Date | null };
  /** Full status-change timeline — feeds the student Journey Tracker. */
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedAt: Date;
    changedBy: string | null;
    reason: string | null;
  }>;
  /** Round-by-round participation — also feeds the Journey Tracker. */
  rounds: Array<{
    id: string;
    title: string;
    type: string;
    scheduledAt: Date | null;
    participant: {
      status: string | null;
      result: string | null;
      feedback: string | null;
      attendanceStatus: string | null;
    } | null;
  }>;
};

// Shared application include
const applicationInclude = {
  student: {
    select: {
      id: true,
      enrollmentNumber: true,
      firstName: true,
      lastName: true,
      batch: {
        select: {
          academicYear: true,
          branch: { select: { code: true, name: true } },
        },
      },
      academicRecord: {
        select: { currentCgpa: true, currentSemester: true },
      },
    },
  },
  jobRole: {
    select: {
      id: true,
      title: true,
      ctcMin: true,
      ctcMax: true,
      drive: {
        select: {
          id: true,
          title: true,
          status: true,
          company: { select: { name: true, logoKey: true } },
        },
      },
    },
  },
  resumeVersion: {
    select: { id: true, fileKey: true, createdAt: true },
  },
  statusHistory: {
    select: { id: true, toStatus: true, note: true, createdAt: true, changedById: true },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

// ─── Apply for Job Role ───────────────────────────────────────────────────────

export async function applyForJobRole(
  studentId: string,
  data: ApplyInput
): Promise<ApplicationWithDetails> {
  const jobRole = await prisma.jobRole.findUnique({
    where: { id: data.jobRoleId, isActive: true },
    include: { drive: { include: { company: true } } },
  });

  if (!jobRole) throw new NotFoundError("Job role not found or inactive");

  if (jobRole.drive.status !== "APPLICATIONS_OPEN") {
    throw new ValidationError("Applications are not currently open for this role");
  }

  if (!jobRole.drive.company.isActive) throw new ValidationError("Company is inactive");

  if (jobRole.drive.applicationCloseAt && new Date() > jobRole.drive.applicationCloseAt) {
    throw new ValidationError("Application deadline has passed");
  }

  const existingApplication = await prisma.application.findFirst({
    where: { studentId, jobRoleId: data.jobRoleId },
  });

  if (existingApplication) throw new ValidationError("You have already applied for this role");

  // Eligibility gate
  const eligibilityResult = await evaluateEligibility(studentId, data.jobRoleId);
  if (!eligibilityResult.eligible) {
    const failedRules = eligibilityResult.results.filter(r => !r.passed).map(r => r.label).join(", ");
    throw new ForbiddenError(`Eligibility requirements not met: ${failedRules}`);
  }

  // Validate resume if provided
  let resumeSnapshotId: string | null = null;
  if (data.resumeVersionId) {
    const resumeVersion = await prisma.resumeVersion.findFirst({
      where: { id: data.resumeVersionId, resume: { studentId } },
    });
    if (!resumeVersion) throw new NotFoundError("Resume version not found");
    resumeSnapshotId = resumeVersion.id;
  }

  const application = await prisma.$transaction(async (tx) => {
    const newApplication = await tx.application.create({
      data: {
        studentId,
        driveId: jobRole.drive.id,
        jobRoleId: data.jobRoleId,
        resumeVersionId: resumeSnapshotId,
        status: ApplicationStatus.APPLIED,
      },
    });

    await tx.applicationStatusHistory.create({
      data: {
        applicationId: newApplication.id,
        toStatus: ApplicationStatus.APPLIED,
        note: "Application submitted by student",
        changedById: studentId,
      },
    });

    return newApplication;
  });

  // Notifications
  try {
    await Promise.all([
      PlacementNotifications.applicationReceived(
        studentId,
        jobRole.drive.company.name,
        jobRole.title
      ),
      (async () => {
        const studentName = await prisma.student.findUniqueOrThrow({
          where: { id: studentId },
          select: { firstName: true, lastName: true },
        });
        const applicationCount = await prisma.application.count({ where: { jobRoleId: data.jobRoleId } });
        await AdminNotifications.applicationReceived(
          jobRole.title,
          `${studentName.firstName} ${studentName.lastName}`,
          applicationCount
        );
      })(),
    ]);
  } catch (error) {
    console.warn("Application notification failed:", error);
  }

  return await getApplicationById(application.id);
}

// ─── Read Applications ────────────────────────────────────────────────────────

export async function getApplicationById(id: string): Promise<ApplicationWithDetails> {
  const application = await prisma.application.findUnique({
    where: { id },
    include: applicationInclude,
  });

  if (!application) throw new NotFoundError("Application not found");

  return application;
}

export async function listApplicationsForDrive(
  driveId: string,
  filters?: {
    jobRoleId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  applications: ApplicationWithDetails[];
  total: number;
  stats: { byStatus: Record<string, number>; byJobRole: Record<string, number> };
}> {
  const where: any = { jobRole: { driveId } };

  if (filters?.jobRoleId) where.jobRoleId = filters.jobRoleId;
  if (filters?.status) where.status = filters.status;

  if (filters?.search) {
    where.OR = [
      { student: { firstName: { contains: filters.search, mode: "insensitive" } } },
      { student: { lastName: { contains: filters.search, mode: "insensitive" } } },
      { student: { enrollmentNumber: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const [applications, total, statusStats, roleStats] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        ...applicationInclude,
        statusHistory: {
          select: { id: true, toStatus: true, note: true, createdAt: true, changedById: true },
          orderBy: { createdAt: "desc" as const },
          take: 1,
        },
      },
      orderBy: { appliedAt: "desc" },
      skip: filters?.offset || 0,
      take: filters?.limit || 50,
    }),
    prisma.application.count({ where }),
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
  ]);

  // Batch-fetch SkillUp averages for every student on this page, rather than
  // one query per row.
  const studentIds = applications.map((a) => a.studentId);
  const skillUpAverages =
    studentIds.length > 0
      ? await prisma.testResult.groupBy({
          by: ["studentId"],
          where: { studentId: { in: studentIds } },
          _avg: { percentage: true },
        })
      : [];
  const skillUpByStudent = new Map(
    skillUpAverages.map((r) => [r.studentId, r._avg.percentage])
  );

  const enriched = applications.map((a) => ({
    ...a,
    skillUpAverage: skillUpByStudent.get(a.studentId) ?? null,
  }));

  return {
    applications: enriched,
    total,
    stats: {
      byStatus: statusStats.reduce((acc, item) => ({ ...acc, [item.status]: item._count._all }), {}),
      byJobRole: roleStats.reduce((acc, item) => ({ ...acc, [item.jobRoleId]: item._count._all }), {}),
    },
  };
}

export async function listStudentApplications(
  studentId: string,
  filters?: {
    academicYear?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  applications: StudentApplicationSummary[];
  total: number;
}> {
  const where: any = { studentId };

  if (filters?.academicYear) {
    where.jobRole = { drive: { academicYear: filters.academicYear } };
  }

  if (filters?.status) where.status = filters.status;

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      select: {
        id: true,
        status: true,
        appliedAt: true,
        jobRole: {
          select: {
            title: true,
            ctcMin: true,
            ctcMax: true,
            drive: {
              select: {
                title: true,
                status: true,
                company: { select: { name: true, logoKey: true } },
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          select: { id: true, fromStatus: true, toStatus: true, createdAt: true, note: true, changedById: true },
        },
        roundParticipations: {
          select: {
            result: true,
            remarks: true,
            attendance: { select: { status: true } },
            round: { select: { id: true, title: true, type: true, scheduledAt: true } },
          },
          orderBy: { round: { roundNumber: "asc" } },
        },
      },
      orderBy: { appliedAt: "desc" },
      skip: filters?.offset || 0,
      take: filters?.limit || 50,
    }),
    prisma.application.count({ where }),
  ]);

  const storage = getStorageAdapter();

  return {
    applications: await Promise.all(
      applications.map(async app => ({
        id: app.id,
        status: app.status,
        appliedAt: app.appliedAt,
        jobRole: app.jobRole,
        company: {
          name: app.jobRole.drive.company.name,
          logoKey: app.jobRole.drive.company.logoKey,
          logoUrl: app.jobRole.drive.company.logoKey
            ? await storage.getSignedUrl(app.jobRole.drive.company.logoKey)
            : null,
        },
        drive: { title: app.jobRole.drive.title, status: app.jobRole.drive.status },
        statusHistory: app.statusHistory.map(h => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          changedAt: h.createdAt,
          changedBy: h.changedById,
          reason: h.note,
        })),
        rounds: app.roundParticipations.map(rp => ({
          id: rp.round.id,
          title: rp.round.title,
          type: rp.round.type,
          scheduledAt: rp.round.scheduledAt,
          participant: {
            // `status` and `attendanceStatus` are deliberately the same
            // value — the two frontend consumers (journey-tracker.tsx,
            // journey-page.tsx) each independently declared both field
            // names for what is really one signal (attendance status).
            status: rp.attendance?.status ?? null,
            result: rp.result,
            feedback: rp.remarks,
            attendanceStatus: rp.attendance?.status ?? null,
          },
        })),
      }))
    ),
    total,
  };
}

// ─── Update Application Status ────────────────────────────────────────────────

export async function updateApplicationStatus(
  id: string,
  data: ApplicationStatusInput,
  changedById: string
): Promise<ApplicationWithDetails> {
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      student: { select: { id: true } },
      jobRole: { include: { drive: { include: { company: true } } } },
    },
  });

  if (!application) throw new NotFoundError("Application not found");

  validateStatusTransition(application.status, data.status);

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id },
      data: { status: data.status as ApplicationStatus },
    });

    await tx.applicationStatusHistory.create({
      data: {
        applicationId: id,
        toStatus: data.status as ApplicationStatus,
        note: data.note,
        changedById,
      },
    });
  });

  await writeAuditLog({
    userId: changedById,
    action: "STATUS_CHANGE",
    entity: "Application",
    entityId: id,
    oldValues: { status: application.status },
    newValues: { status: data.status, note: data.note ?? null },
    metadata: {
      studentId: application.studentId,
      jobRoleId: application.jobRoleId,
    },
  });

  // Notifications
  try {
    await PlacementNotifications.statusChanged(
      application.studentId,
      application.jobRole.drive.company.name,
      application.jobRole.title,
      data.status
    );

    if (data.status === "SHORTLISTED") {
      await PlacementNotifications.shortlisted(application.studentId, application.jobRole.drive.company.name, application.jobRole.title);
    } else if (data.status === "SELECTED") {
      await PlacementNotifications.selected(application.studentId, application.jobRole.drive.company.name, application.jobRole.title);
    } else if (data.status === "REJECTED") {
      await PlacementNotifications.rejected(application.studentId, application.jobRole.drive.company.name, application.jobRole.title);
    }
  } catch (error) {
    console.warn("Application status notification failed:", error);
  }

  return await getApplicationById(id);
}

// ─── Withdraw Application ─────────────────────────────────────────────────────

export async function withdrawApplication(
  id: string,
  reason?: string
): Promise<ApplicationWithDetails> {
  const application = await prisma.application.findUnique({
    where: { id },
    select: { studentId: true, status: true },
  });

  if (!application) throw new NotFoundError("Application not found");

  if (["SELECTED", "REJECTED", "WITHDRAWN"].includes(application.status)) {
    throw new ValidationError("Cannot withdraw application in current status");
  }

  // Phase 5: whether withdrawal is allowed once a student has been
  // shortlisted is a policy value, batch-scoped with an institute default.
  const POST_SHORTLIST_STATUSES = [
    "SHORTLISTED",
    "WRITTEN_TEST",
    "TECHNICAL_ROUND",
    "HR_ROUND",
    "FINAL_ROUND",
  ];
  if (POST_SHORTLIST_STATUSES.includes(application.status)) {
    const student = await prisma.student.findUnique({
      where: { id: application.studentId },
      select: { batchId: true },
    });
    const allowed = await getPolicyValue<boolean>(
      "withdrawal_allowed_after_shortlist",
      student?.batchId ?? null
    );
    if (!allowed) {
      throw new ValidationError(
        "Withdrawal is not permitted once you have been shortlisted, per placement policy. Contact the placement cell if you need to withdraw."
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id },
      data: { status: ApplicationStatus.WITHDRAWN },
    });

    await tx.applicationStatusHistory.create({
      data: {
        applicationId: id,
        toStatus: ApplicationStatus.WITHDRAWN,
        note: reason || "Withdrawn by student",
        changedById: application.studentId,
      },
    });
  });

  return await getApplicationById(id);
}

// ─── Application Statistics ───────────────────────────────────────────────────

export async function getApplicationStats(driveId?: string): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byAcademicYear: Record<string, number>;
  recentApplications: number;
}> {
  const where = driveId ? { jobRole: { driveId } } : {};
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, byStatus, recentApplications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.application.count({
      where: { ...where, appliedAt: { gte: sevenDaysAgo } },
    }),
  ]);

  return {
    total,
    byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item.status]: item._count._all }), {}),
    byAcademicYear: {},
    recentApplications,
  };
}

// ─── Auto-close applications after deadline ──────────────────────────────────

export async function processApplicationDeadlines(): Promise<void> {
  const now = new Date();

  const expiredDrives = await prisma.placementDrive.findMany({
    where: {
      status: "APPLICATIONS_OPEN",
      applicationCloseAt: { lt: now },
    },
  });

  if (expiredDrives.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const drive of expiredDrives) {
      await tx.placementDrive.update({
        where: { id: drive.id },
        data: { status: "APPLICATIONS_CLOSED" },
      });
    }
  });

  console.log(`Auto-closed applications for ${expiredDrives.length} drives`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateStatusTransition(from: string, to: string): void {
  const transitions: Record<string, string[]> = {
    APPLIED: ["UNDER_REVIEW", "SHORTLISTED", "REJECTED", "WITHDRAWN"],
    UNDER_REVIEW: ["SHORTLISTED", "WRITTEN_TEST", "REJECTED"],
    SHORTLISTED: ["WRITTEN_TEST", "TECHNICAL_ROUND", "HR_ROUND", "REJECTED"],
    WRITTEN_TEST: ["TECHNICAL_ROUND", "REJECTED"],
    TECHNICAL_ROUND: ["HR_ROUND", "FINAL_ROUND", "SELECTED", "REJECTED"],
    HR_ROUND: ["FINAL_ROUND", "SELECTED", "REJECTED"],
    FINAL_ROUND: ["SELECTED", "REJECTED", "ON_HOLD"],
    ON_HOLD: ["SELECTED", "REJECTED"],
    SELECTED: [],
    REJECTED: [],
    WITHDRAWN: [],
  };

  if (!transitions[from]?.includes(to)) {
    throw new ValidationError(`Invalid status transition from ${from} to ${to}`);
  }
}
