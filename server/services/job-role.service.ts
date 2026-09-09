/**
 * Job Role Service — Phase 3
 *
 * CRUD operations for job roles within placement drives.
 * Each drive can have multiple roles with different eligibility criteria.
 */

import { prisma } from "@/lib/prisma";
import { JobRoleInput, EligibilityRuleInput } from "@/lib/validations/placement";
import { NotFoundError, ValidationError } from "@/lib/errors";

export type JobRoleWithDetails = {
  id: string;
  driveId: string;
  title: string;
  description: string | null;
  responsibilities: string | null;
  requirements: string | null;
  ctcMin: number | null;
  ctcMax: number | null;
  ctcBreakdown: string | null;
  openings: number | null;
  skills: string[];
  workMode: string;
  locations: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  drive: {
    id: string;
    title: string;
    status: string;
    company: {
      name: string;
    };
  };
  eligibilityRules: Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
    label: string;
    isActive: boolean;
  }>;
  _count: {
    applications: number;
    eligibilityRules: number;
  };
};

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createJobRole(
  driveId: string,
  data: JobRoleInput
): Promise<JobRoleWithDetails> {
  // Validate drive exists and is editable
  const drive = await prisma.placementDrive.findUnique({
    where: { id: driveId },
    select: { id: true, status: true },
  });

  if (!drive) {
    throw new NotFoundError("Placement drive not found");
  }

  if (!["DRAFT", "PUBLISHED"].includes(drive.status)) {
    throw new ValidationError("Cannot add roles to drive in current status");
  }

  const jobRole = await prisma.jobRole.create({
    data: {
      ...data,
      driveId,
    },
    include: {
      drive: {
        select: {
          id: true,
          title: true,
          status: true,
          company: { select: { name: true } },
        },
      },
      eligibilityRules: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          applications: true,
          eligibilityRules: true,
        },
      },
    },
  });

  return jobRole as JobRoleWithDetails;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listJobRoles(
  driveId: string,
  filters?: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{
  jobRoles: JobRoleWithDetails[];
  total: number;
}> {
  const where: any = { driveId };

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const [jobRoles, total] = await Promise.all([
    prisma.jobRole.findMany({
      where,
      include: {
        drive: {
          select: {
            id: true,
            title: true,
            status: true,
            company: { select: { name: true } },
          },
        },
        eligibilityRules: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            applications: true,
            eligibilityRules: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      skip: filters?.offset || 0,
      take: filters?.limit || 50,
    }),
    prisma.jobRole.count({ where }),
  ]);

  return {
    jobRoles: jobRoles as JobRoleWithDetails[],
    total,
  };
}

export async function getJobRoleById(id: string): Promise<JobRoleWithDetails> {
  const jobRole = await prisma.jobRole.findUnique({
    where: { id },
    include: {
      drive: {
        select: {
          id: true,
          title: true,
          status: true,
          company: { select: { name: true } },
        },
      },
      eligibilityRules: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          applications: true,
          eligibilityRules: true,
        },
      },
    },
  });

  if (!jobRole) {
    throw new NotFoundError("Job role not found");
  }

  return jobRole as JobRoleWithDetails;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateJobRole(
  id: string,
  data: Partial<JobRoleInput>
): Promise<JobRoleWithDetails> {
  const existing = await prisma.jobRole.findUnique({
    where: { id },
    include: { drive: { select: { status: true } } },
  });

  if (!existing) {
    throw new NotFoundError("Job role not found");
  }

  // Prevent editing if drive has started accepting applications
  if (["APPLICATIONS_OPEN", "ONGOING", "COMPLETED"].includes(existing.drive.status)) {
    throw new ValidationError("Cannot edit job role after applications open");
  }

  const jobRole = await prisma.jobRole.update({
    where: { id },
    data,
    include: {
      drive: {
        select: {
          id: true,
          title: true,
          status: true,
          company: { select: { name: true } },
        },
      },
      eligibilityRules: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          applications: true,
          eligibilityRules: true,
        },
      },
    },
  });

  return jobRole as JobRoleWithDetails;
}

export async function toggleJobRoleStatus(id: string): Promise<JobRoleWithDetails> {
  const existing = await prisma.jobRole.findUnique({
    where: { id },
    include: { drive: { select: { status: true } } },
  });

  if (!existing) {
    throw new NotFoundError("Job role not found");
  }

  // Can't deactivate if there are applications
  if (!existing.isActive) {
    // Activating - check drive status
    if (["ONGOING", "COMPLETED", "CANCELLED"].includes(existing.drive.status)) {
      throw new ValidationError("Cannot activate job role in current drive status");
    }
  } else {
    // Deactivating - check for applications
    const applicationCount = await prisma.application.count({
      where: { jobRoleId: id },
    });

    if (applicationCount > 0) {
      throw new ValidationError("Cannot deactivate job role with existing applications");
    }
  }

  const jobRole = await prisma.jobRole.update({
    where: { id },
    data: { isActive: !existing.isActive },
    include: {
      drive: {
        select: {
          id: true,
          title: true,
          status: true,
          company: { select: { name: true } },
        },
      },
      eligibilityRules: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          applications: true,
          eligibilityRules: true,
        },
      },
    },
  });

  return jobRole as JobRoleWithDetails;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteJobRole(id: string): Promise<void> {
  const jobRole = await prisma.jobRole.findUnique({
    where: { id },
    include: {
      drive: { select: { status: true } },
      _count: { select: { applications: true } },
    },
  });

  if (!jobRole) {
    throw new NotFoundError("Job role not found");
  }

  // Can only delete if no applications and drive is not active
  if (jobRole._count.applications > 0) {
    throw new ValidationError("Cannot delete job role with applications");
  }

  if (!["DRAFT", "CANCELLED"].includes(jobRole.drive.status)) {
    throw new ValidationError("Can only delete job roles from draft or cancelled drives");
  }

  await prisma.jobRole.delete({ where: { id } });
}

// ─── Eligibility Rules Management ─────────────────────────────────────────────

export async function addEligibilityRule(
  jobRoleId: string,
  data: EligibilityRuleInput
): Promise<JobRoleWithDetails> {
  // Validate job role exists and is editable
  const jobRole = await prisma.jobRole.findUnique({
    where: { id: jobRoleId },
    include: { drive: { select: { status: true } } },
  });

  if (!jobRole) {
    throw new NotFoundError("Job role not found");
  }

  if (!["DRAFT", "PUBLISHED"].includes(jobRole.drive.status)) {
    throw new ValidationError("Cannot add eligibility rules after applications open");
  }

  await prisma.eligibilityRule.create({
    data: {
      ...data,
      jobRoleId,
    },
  });

  return await getJobRoleById(jobRoleId);
}

export async function updateEligibilityRule(
  ruleId: string,
  data: Partial<EligibilityRuleInput>
): Promise<void> {
  const rule = await prisma.eligibilityRule.findUnique({
    where: { id: ruleId },
    include: {
      jobRole: {
        include: { drive: { select: { status: true } } },
      },
    },
  });

  if (!rule) {
    throw new NotFoundError("Eligibility rule not found");
  }

  if (!["DRAFT", "PUBLISHED"].includes(rule.jobRole.drive.status)) {
    throw new ValidationError("Cannot update eligibility rules after applications open");
  }

  await prisma.eligibilityRule.update({
    where: { id: ruleId },
    data,
  });
}

export async function deleteEligibilityRule(ruleId: string): Promise<void> {
  const rule = await prisma.eligibilityRule.findUnique({
    where: { id: ruleId },
    include: {
      jobRole: {
        include: { drive: { select: { status: true } } },
      },
    },
  });

  if (!rule) {
    throw new NotFoundError("Eligibility rule not found");
  }

  if (!["DRAFT", "PUBLISHED"].includes(rule.jobRole.drive.status)) {
    throw new ValidationError("Cannot delete eligibility rules after applications open");
  }

  await prisma.eligibilityRule.delete({ where: { id: ruleId } });
}

export async function toggleEligibilityRuleStatus(ruleId: string): Promise<void> {
  const rule = await prisma.eligibilityRule.findUnique({
    where: { id: ruleId },
    include: {
      jobRole: {
        include: { drive: { select: { status: true } } },
      },
    },
  });

  if (!rule) {
    throw new NotFoundError("Eligibility rule not found");
  }

  if (!["DRAFT", "PUBLISHED"].includes(rule.jobRole.drive.status)) {
    throw new ValidationError("Cannot modify eligibility rules after applications open");
  }

  await prisma.eligibilityRule.update({
    where: { id: ruleId },
    data: { isActive: !rule.isActive },
  });
}

// ─── Bulk Operations ──────────────────────────────────────────────────────────

export async function bulkUpdateEligibilityRules(
  jobRoleId: string,
  rules: EligibilityRuleInput[]
): Promise<JobRoleWithDetails> {
  const jobRole = await prisma.jobRole.findUnique({
    where: { id: jobRoleId },
    include: { drive: { select: { status: true } } },
  });

  if (!jobRole) {
    throw new NotFoundError("Job role not found");
  }

  if (!["DRAFT", "PUBLISHED"].includes(jobRole.drive.status)) {
    throw new ValidationError("Cannot modify eligibility rules after applications open");
  }

  await prisma.$transaction(async (tx) => {
    // Delete existing rules
    await tx.eligibilityRule.deleteMany({
      where: { jobRoleId },
    });

    // Create new rules
    if (rules.length > 0) {
      await tx.eligibilityRule.createMany({
        data: rules.map((rule) => ({
          ...rule,
          jobRoleId,
        })),
      });
    }
  });

  return await getJobRoleById(jobRoleId);
}