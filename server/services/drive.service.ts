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
import { writeAuditLog } from "./audit.service";
import { acceptingApplicationsWhere, hasApplicationsClosed } from "@/lib/drive-status";

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
    isActive: boolean;
  };
  _count: {
    /** Active job roles only — see the comments on listDrives/getDriveById. */
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

// Valid status transitions - enforces business rules.
//
// Phase 19: APPLICATIONS_OPEN/APPLICATIONS_CLOSED are no longer reachable
// manual transitions — whether a PUBLISHED drive is currently accepting
// applications is derived from its dates (lib/drive-status.ts), not
// clicked into. PUBLISHED -> ONGOING now requires that derived "closed"
// state (see the check in updateDriveStatus below) instead of a separate
// APPLICATIONS_CLOSED step first. The two enum values remain valid at the
// database level (existing historical rows, if any survive the Phase 19
// backfill migration, and Zod's schema validation) but are dead ends here
// — no `from` state lists either as a `to`.
const STATUS_MACHINE: Record<string, string[]> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["ONGOING", "CANCELLED"],
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
          isActive: true,
        },
      },
      // Phase 18 P2 follow-up: filtered to isActive so this count agrees
      // with updateDriveStatus's own "at least one active role" check
      // below — previously counted inactive roles too, so a drive with
      // roles that were all deactivated could show a nonzero count here
      // and let the admin UI enable "Publish" for a request the server
      // would still reject.
      _count: {
        select: {
          jobRoles: { where: { isActive: true } },
          applications: true,
          rounds: true,
        },
      },
    },
  });

  await writeAuditLog({
    userId: createdById,
    action: "CREATE",
    entity: "PlacementDrive",
    entityId: drive.id,
    newValues: {
      title: drive.title,
      companyId: drive.companyId,
      academicYear: drive.academicYear,
      status: drive.status,
    },
  });

  return drive;
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
            isActive: true,
          },
        },
        // See the matching comment on getDriveById/createDrive/updateDrive
        // /updateDriveStatus above — filtered to agree with the actual
        // "at least one active role" publish gate.
        _count: {
          select: {
            jobRoles: { where: { isActive: true } },
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
    drives,
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
          isActive: true,
        },
      },
      // Phase 18 P2 follow-up: filtered to isActive so this count agrees
      // with updateDriveStatus's own "at least one active role" check
      // below — previously counted inactive roles too, so a drive with
      // roles that were all deactivated could show a nonzero count here
      // and let the admin UI enable "Publish" for a request the server
      // would still reject.
      _count: {
        select: {
          jobRoles: { where: { isActive: true } },
          applications: true,
          rounds: true,
        },
      },
    },
  });

  if (!drive) {
    throw new NotFoundError("Placement drive not found");
  }

  return drive;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateDrive(
  id: string,
  data: Partial<DriveInput>,
  changedById?: string
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
          isActive: true,
        },
      },
      // Phase 18 P2 follow-up: filtered to isActive so this count agrees
      // with updateDriveStatus's own "at least one active role" check
      // below — previously counted inactive roles too, so a drive with
      // roles that were all deactivated could show a nonzero count here
      // and let the admin UI enable "Publish" for a request the server
      // would still reject.
      _count: {
        select: {
          jobRoles: { where: { isActive: true } },
          applications: true,
          rounds: true,
        },
      },
    },
  });

  await writeAuditLog({
    userId: changedById,
    action: "UPDATE",
    entity: "PlacementDrive",
    entityId: id,
    newValues: parsedData as Record<string, unknown>,
  });

  return drive;
}

// ─── Status Management ────────────────────────────────────────────────────────

export async function updateDriveStatus(
  id: string,
  newStatus: string,
  changedById?: string
): Promise<DriveWithDetails> {
  const drive = await prisma.placementDrive.findUnique({
    where: { id },
    include: {
      company: true,
      jobRoles: { where: { isActive: true }, select: { id: true } },
    },
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

  // Phase 18 P2 — root cause of a real "nothing shows to students" report:
  // a drive with zero job roles was reaching "open" with nothing wrong
  // with it structurally, but nothing for a student to ever see or apply
  // to either — a dead end that looked like a bug from the admin side.
  if (newStatus === "PUBLISHED" && drive.jobRoles.length === 0) {
    throw new ValidationError(
      "Add at least one job role before publishing this drive — an empty drive has nothing for students to apply to."
    );
  }

  // Phase 19: PUBLISHED -> ONGOING replaces the old, separately-clicked
  // APPLICATIONS_CLOSED step — rounds still shouldn't start while the
  // drive's own dates say applications are still open, but that's now a
  // date check, not a status an admin has to remember to set first.
  if (newStatus === "ONGOING" && !hasApplicationsClosed(drive)) {
    throw new ValidationError(
      "Applications are still open — rounds can start once the application window closes."
    );
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
          isActive: true,
        },
      },
      // Phase 18 P2 follow-up: filtered to isActive so this count agrees
      // with updateDriveStatus's own "at least one active role" check
      // below — previously counted inactive roles too, so a drive with
      // roles that were all deactivated could show a nonzero count here
      // and let the admin UI enable "Publish" for a request the server
      // would still reject.
      _count: {
        select: {
          jobRoles: { where: { isActive: true } },
          applications: true,
          rounds: true,
        },
      },
    },
  });

  await writeAuditLog({
    userId: changedById,
    action: "STATUS_CHANGE",
    entity: "PlacementDrive",
    entityId: id,
    oldValues: { status: drive.status },
    newValues: { status: newStatus },
  });

  // Send notifications for certain transitions
  await handleStatusNotifications(updatedDrive, newStatus);

  return updatedDrive;
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
  // Phase 13 — a drive with no close date set (a real, normal case — the
  // form field is optional) was being excluded entirely by a bare `{gt:
  // now}` filter, which a null never satisfies; a close date, when set, is
  // an additional automatic cutoff on top of "published", not a
  // requirement for visibility.
  //
  // Phase 18 P2 — the mirror-image bug on the open side had never been
  // caught: this query never checked applicationOpenAt at all, so a
  // drive scheduled to open in the future was visible to students
  // immediately once published.
  //
  // Phase 19 — both of those date checks, plus the "PUBLISHED" status
  // check, are now acceptingApplicationsWhere() (lib/drive-status.ts):
  // the single source of truth for "is this drive currently open," reused
  // by every other query that needs the same answer instead of each
  // carrying its own (previously drifting — see student/dashboard/page.tsx
  // before this phase) copy of this logic.
  const where: any = {
    ...acceptingApplicationsWhere(),
    company: { isActive: true },
  };

  if (filters?.search) {
    where.AND.push({
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { company: { name: { contains: filters.search, mode: "insensitive" } } },
        { jobRoles: { some: { title: { contains: filters.search, mode: "insensitive" } } } },
      ],
    });
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
  contactInfo: {
    name: string | null;
    email: string | null;
    phone: string | null;
    designation: string | null;
  };
  prePlacementTalk: {
    scheduledAt: Date;
    durationMins: number | null;
    venue: string | null;
    meetingLink: string | null;
    instructions: string | null;
    faq: string | null;
  } | null;
}> {
  const drive = await prisma.placementDrive.findUnique({
    where: { 
      id,
      // Phase 19: PUBLISHED now covers what used to be split across
      // APPLICATIONS_OPEN/APPLICATIONS_CLOSED — the detail page stays
      // viewable whether or not the drive's date window is currently
      // "open" (applyForJobRole enforces that separately at apply time).
      status: { in: ["PUBLISHED", "ONGOING"] },
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
          isActive: true,
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
      prePlacementTalk: {
        select: {
          scheduledAt: true,
          durationMins: true,
          venue: true,
          meetingLink: true,
          instructions: true,
          faq: true,
        },
      },
    },
  });

  if (!drive) {
    throw new NotFoundError("Opportunity not found or not available");
  }

  // The frontend (opportunity-detail-content.tsx) expects a nested
  // `contactInfo` object — PlacementDrive stores these as flat scalar
  // fields (pointOfContact/pocEmail/pocPhone), so they must be reshaped
  // here rather than returned raw. The previous `return drive as any`
  // hid this mismatch from tsc entirely and crashed the page on every
  // single opportunity (TypeError: Cannot read properties of undefined
  // (reading 'name')) — found via Phase 9's real-browser verification,
  // not by the type checker or an API-level check.
  return {
    ...drive,
    contactInfo: {
      name: drive.pointOfContact,
      email: drive.pocEmail,
      phone: drive.pocPhone,
      designation: null, // no such field on PlacementDrive
    },
  };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteDrive(id: string, deletedById?: string): Promise<void> {
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

  await writeAuditLog({
    userId: deletedById,
    action: "DELETE",
    entity: "PlacementDrive",
    entityId: id,
    oldValues: { status: drive.status },
  });
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
        // Phase 19: this used to fire on the separate, manually-clicked
        // APPLICATIONS_OPEN transition. Publishing is now the only step —
        // the deadline reminder belongs here instead, still gated on
        // actually having a close date to remind about.
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