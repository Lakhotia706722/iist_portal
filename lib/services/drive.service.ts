/**
 * Drive Service — Phase 3
 *
 * Placement drive lifecycle management with status transitions,
 * student-facing opportunity queries, and admin CRUD operations.
 */

import { prisma } from "@/lib/prisma";
import { DriveInput } from "@/lib/validations/placement";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { PlacementNotifications } from "@/lib/notifications";
import { DriveStatus } from "@prisma/client";

export type DriveWithDetails = {
  id: string;
  companyId: string;
  title: string;
  academicYear: string;
  status: string;
  description: string | null;
  applicationOpenAt: Date | null;
  applicationCloseAt: Date | null;
  driveStartDate: Date | null;
  driveEndDate: Date | null;
  workMode: string;
  locations: string[];
  bond: string | null;
  selectionProcess: string | null;
  perksAndBenefits: string | null;
  pointOfContact: string | null;
  pocEmail: string | null;
  pocPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  company: {
    id: string;
    name: string;
    slug: string;
    industry: string;
    logoKey: string | null;
  };
  _count: {
    jobRoles: number;
    applications: number;
    rounds: number;
  };
};

type DriveStatusTransition = {
  from: string;
  to: string;
  allowed: boolean;
  reason?: string;
};

// Valid status transitions - enforces business rules
const STATUS_MACHINE: Record<string, string[]> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["APPLICATIONS_OPEN", "CANCELLED"],
  APPLICATIONS_OPEN: ["APPLICATIONS_CLOSED", "CANCELLED"],
  APPLICATIONS_CLOSED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [], // Final state
  CANCELLED: [], // Final state
};

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createDrive(data: DriveInput, createdById: string): Promise<DriveWithDetails> {
  // Validate company exists
  const company = await prisma.company.findUnique({
    where: { id: data.companyId, isActive: true },
  });

  if (!company) {
    throw new NotFoundError("Active company not found");
  }

  // Parse date strings to Date objects
  const parsedData = {
    ...data,
    createdById,
    applicationOpenAt: data.applicationOpenAt ? new Date(data.applicationOpenAt) : null,
    applicationCloseAt: data.applicationCloseAt ? new Date(data.applicationCloseAt) : null,
    driveStartDate: data.driveStartDate ? new Date(data.driveStartDate) : null,
    driveEndDate: data.driveEndDate ? new Date(data.driveEndDate) : null,
  };

  // Validate date sequence
  validateDriveDates(parsedData);

  const drive = await prisma.placementDrive.create({
    data: parsedData,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          industry: true,
          logoKey: true,
        },
      },
      _count: {
        select: {
          jobRoles: true,
          applications: true,
          rounds: true,
        },
      },
    },
  });

  return drive as unknown as DriveWithDetails;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listDrives(filters?: {
  companyId?: string;
  academicYear?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  drives: DriveWithDetails[];
  total: number;
}> {
  const where: any = {};

  if (filters?.companyId) {
    where.companyId = filters.companyId;
  }

  if (filters?.academicYear) {
    where.academicYear = filters.academicYear;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { company: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const [drives, total] = await Promise.all([
    prisma.placementDrive.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            industry: true,
            logoKey: true,
          },
        },
        _count: {
          select: {
            jobRoles: true,
            applications: true,
            rounds: true,
          },
        },
      },
      orderBy: [
        { status: "asc" }, // DRAFT/PUBLISHED first
        { applicationOpenAt: "desc" },
        { createdAt: "desc" },
      ],
      skip: filters?.offset || 0,
      take: filters?.limit || 50,
    }),
    prisma.placementDrive.count({ where }),
  ]);

  return {
    drives: drives as unknown as DriveWithDetails[],
    total,
  };
}

export async function getDriveById(id: string): Promise<DriveWithDetails> {
  const drive = await prisma.placementDrive.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          industry: true,
          logoKey: true,
        },
      },
      _count: {
        select: {
          jobRoles: true,
          applications: true,
          rounds: true,
        },
      },
    },
  });

  if (!drive) {
    throw new NotFoundError("Placement drive not found");
  }

  return drive as unknown as DriveWithDetails;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateDrive(
  id: string,
  data: Partial<DriveInput>
): Promise<DriveWithDetails> {
  const existing = await prisma.placementDrive.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError("Placement drive not found");
  }

  // Prevent editing if drive is in progress or completed
  if (["ONGOING", "COMPLETED", "CANCELLED"].includes(existing.status)) {
    throw new ValidationError("Cannot edit drive in current status");
  }

  // Parse date strings if provided
  const parsedData: any = { ...data };
  if (data.applicationOpenAt) {
    parsedData.applicationOpenAt = new Date(data.applicationOpenAt);
  }
  if (data.applicationCloseAt) {
    parsedData.applicationCloseAt = new Date(data.applicationCloseAt);
  }
  if (data.driveStartDate) {
    parsedData.driveStartDate = new Date(data.driveStartDate);
  }
  if (data.driveEndDate) {
    parsedData.driveEndDate = new Date(data.driveEndDate);
  }

  // Validate dates if any are being updated
  if (Object.keys(parsedData).some(key => key.includes("At") || key.includes("Date"))) {
    const fullData = await prisma.placementDrive.findUniqueOrThrow({
      where: { id },
    });
    validateDriveDates({ ...fullData, ...parsedData });
  }

  const drive = await prisma.placementDrive.update({
    where: { id },
    data: parsedData,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          industry: true,
          logoKey: true,
        },
      },
      _count: {
        select: {
          jobRoles: true,
          applications: true,
          rounds: true,
        },
      },
    },
  });

  return drive as unknown as DriveWithDetails;
}

// ─── Status Management ────────────────────────────────────────────────────────

export async function updateDriveStatus(
  id: string,
  newStatus: string
): Promise<DriveWithDetails> {
  const drive = await prisma.placementDrive.findUnique({
    where: { id },
    include: { company: true },
  });

  if (!drive) {
    throw new NotFoundError("Placement drive not found");
  }

  // Validate transition
  const transition = validateStatusTransition(drive.status, newStatus);
  if (!transition.allowed) {
    throw new ValidationError(transition.reason || "Invalid status transition");
  }

  // Additional validations per status
  if (newStatus === "PUBLISHED" && !drive.company.isActive) {
    throw new ValidationError("Cannot publish drive for inactive company");
  }

  const updatedDrive = await prisma.placementDrive.update({
    where: { id },
    data: { status: newStatus as DriveStatus },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          industry: true,
          logoKey: true,
        },
      },
      _count: {
        select: {
          jobRoles: true,
          applications: true,
          rounds: true,
        },
      },
    },
  });

  // Send notifications for certain transitions
  await handleStatusNotifications(updatedDrive as unknown as DriveWithDetails, newStatus);

  return updatedDrive as unknown as DriveWithDetails;
}

// ─── Student-Facing Queries ───────────────────────────────────────────────────

export async function listActiveOpportunities(filters?: {
  search?: string;
  industry?: string;
  workMode?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  opportunities: Array<{
    id: string;
    title: string;
    company: {
      name: string;
      industry: string;
      logoKey: string | null;
    };
    workMode: string;
    locations: string[];
    applicationCloseAt: Date | null;
    jobRoles: Array<{
      id: string;
      title: string;
      ctcMin: number | null;
      ctcMax: number | null;
    }>;
    _count: {
      applications: number;
    };
  }>;
  total: number;
}> {
  const where: any = {
    status: "APPLICATIONS_OPEN",
    company: { isActive: true },
    applicationCloseAt: {
      gt: new Date(), // Not yet closed
    },
  };

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { company: { name: { contains: filters.search, mode: "insensitive" } } },
      { jobRoles: { some: { title: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  if (filters?.industry) {
    where.company = { ...where.company, industry: filters.industry };
  }

  if (filters?.workMode) {
    where.workMode = filters.workMode;
  }

  const [opportunities, total] = await Promise.all([
    prisma.placementDrive.findMany({
      where,
      select: {
        id: true,
        title: true,
        workMode: true,
        locations: true,
        applicationCloseAt: true,
        company: {
          select: {
            name: true,
            industry: true,
            logoKey: true,
          },
        },
        jobRoles: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            ctcMin: true,
            ctcMax: true,
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: [
        { applicationCloseAt: "asc" }, // Closing soon first
        { createdAt: "desc" },
      ],
      skip: filters?.offset || 0,
      take: filters?.limit || 20,
    }),
    prisma.placementDrive.count({ where }),
  ]);

  return { opportunities, total };
}

export async function getOpportunityDetail(id: string): Promise<DriveWithDetails & {
  jobRoles: Array<{
    id: string;
    title: string;
    description: string | null;
    ctcMin: number | null;
    ctcMax: number | null;
    openings: number | null;
    skills: string[];
    eligibilityRules: Array<{
      id: string;
      label: string;
      field: string;
      operator: string;
      value: string;
    }>;
  }>;
}> {
  const drive = await prisma.placementDrive.findUnique({
    where: { 
      id,
      status: { in: ["APPLICATIONS_OPEN", "APPLICATIONS_CLOSED", "ONGOING"] },
      company: { isActive: true },
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          industry: true,
          logoKey: true,
        },
      },
      jobRoles: {
        where: { isActive: true },
        include: {
          eligibilityRules: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          jobRoles: true,
          applications: true,
          rounds: true,
        },
      },
    },
  });

  if (!drive) {
    throw new NotFoundError("Opportunity not found or not available");
  }

  return drive as any;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteDrive(id: string): Promise<void> {
  const drive = await prisma.placementDrive.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!drive) {
    throw new NotFoundError("Placement drive not found");
  }

  // Can only delete drafts or cancelled drives
  if (!["DRAFT", "CANCELLED"].includes(drive.status)) {
    throw new ValidationError("Can only delete draft or cancelled drives");
  }

  await prisma.placementDrive.delete({ where: { id } });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateStatusTransition(from: string, to: string): DriveStatusTransition {
  const allowed = STATUS_MACHINE[from]?.includes(to) ?? false;
  
  if (!allowed) {
    return {
      from,
      to,
      allowed: false,
      reason: `Cannot transition from ${from} to ${to}. Valid transitions: ${STATUS_MACHINE[from]?.join(", ") || "none"}`,
    };
  }

  return { from, to, allowed: true };
}

function validateDriveDates(data: {
  applicationOpenAt?: Date | null;
  applicationCloseAt?: Date | null;
  driveStartDate?: Date | null;
  driveEndDate?: Date | null;
}): void {
  const { applicationOpenAt, applicationCloseAt, driveStartDate, driveEndDate } = data;

  if (applicationOpenAt && applicationCloseAt) {
    if (applicationOpenAt >= applicationCloseAt) {
      throw new ValidationError("Application close date must be after open date");
    }
  }

  if (applicationCloseAt && driveStartDate) {
    if (applicationCloseAt >= driveStartDate) {
      throw new ValidationError("Drive start date must be after application close date");
    }
  }

  if (driveStartDate && driveEndDate) {
    if (driveStartDate >= driveEndDate) {
      throw new ValidationError("Drive end date must be after start date");
    }
  }
}

async function handleStatusNotifications(
  drive: DriveWithDetails,
  newStatus: string
): Promise<void> {
  try {
    switch (newStatus) {
      case "PUBLISHED":
        await PlacementNotifications.drivePublished(
          drive.id,
          drive.company.name,
          drive.title
        );
        break;

      case "APPLICATIONS_OPEN":
        if (drive.applicationCloseAt) {
          await PlacementNotifications.applicationsClosing(
            drive.id,
            drive.title,
            drive.applicationCloseAt
          );
        }
        break;
    }
  } catch (error) {
    console.warn("Notification failed for drive status change:", error);
    // Don't fail the status update for notification issues
  }
}