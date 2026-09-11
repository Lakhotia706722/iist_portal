/**
 * Offer Service — Phase 3.5
 *
 * An Offer is created from an Application that has reached SELECTED.
 * Every create / update / status change / letter upload writes an AuditLog row.
 */

import { prisma } from "@/lib/prisma";
import type { OfferStatus, Prisma } from "@prisma/client";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { writeAuditLog, type AuditParams } from "./audit.service";
import { getStorageAdapter } from "@/lib/storage";
import { PlacementNotifications } from "@/lib/notifications";
import { getPolicyValue } from "./policy.service";
import type {
  CreateOfferInput,
  UpdateOfferInput,
  OfferFilters,
} from "@/lib/validations/offer";
import { randomUUID } from "crypto";

type RequestMeta = Pick<AuditParams, "ipAddress" | "userAgent">;

const OFFER_INCLUDE = {
  student: {
    select: {
      id: true,
      enrollmentNumber: true,
      firstName: true,
      lastName: true,
      user: { select: { name: true, email: true } },
      branch: { select: { name: true, code: true } },
      batch: { select: { name: true, academicYear: true } },
    },
  },
  company: { select: { id: true, name: true, logoKey: true, industry: true } },
  drive: { select: { id: true, title: true, academicYear: true } },
  jobRole: { select: { id: true, title: true } },
  application: { select: { id: true, status: true } },
} satisfies Prisma.OfferInclude;

export type OfferWithDetails = Prisma.OfferGetPayload<{
  include: typeof OFFER_INCLUDE;
}>;

/**
 * Legal status transitions. An offer is terminal once JOINED, DECLINED or
 * WITHDRAWN — reversing those would silently corrupt placement statistics.
 */
const STATUS_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  OFFERED: ["ACCEPTED", "DECLINED", "WITHDRAWN"],
  ACCEPTED: ["JOINED", "WITHDRAWN", "DECLINED"],
  DECLINED: [],
  JOINED: [],
  WITHDRAWN: [],
};

const STATUS_TIMESTAMP: Partial<Record<OfferStatus, keyof Prisma.OfferUpdateInput>> = {
  ACCEPTED: "acceptedAt",
  DECLINED: "declinedAt",
  JOINED: "joinedAt",
  WITHDRAWN: "withdrawnAt",
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listOffers(
  filters: Partial<OfferFilters> = {}
): Promise<{ offers: OfferWithDetails[]; total: number }> {
  const where: Prisma.OfferWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.driveId ? { driveId: filters.driveId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.academicYear
      ? { drive: { academicYear: filters.academicYear } }
      : {}),
  };

  const [offers, total] = await Promise.all([
    prisma.offer.findMany({
      where,
      include: OFFER_INCLUDE,
      orderBy: { offerDate: "desc" },
      take: filters.limit ?? 25,
      skip: filters.offset ?? 0,
    }),
    prisma.offer.count({ where }),
  ]);

  return { offers, total };
}

export async function getOfferById(id: string): Promise<OfferWithDetails> {
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: OFFER_INCLUDE,
  });
  if (!offer) throw new NotFoundError("Offer not found");
  return offer;
}

/** Placement history for a single student (student-facing). */
export async function listOffersForStudent(
  studentId: string
): Promise<OfferWithDetails[]> {
  return prisma.offer.findMany({
    where: { studentId },
    include: OFFER_INCLUDE,
    orderBy: { offerDate: "desc" },
  });
}

/**
 * Applications that are SELECTED but have no offer recorded yet — the only
 * valid targets for createOffer().
 */
export async function listOfferableApplications(driveId?: string) {
  return prisma.application.findMany({
    where: {
      status: "SELECTED",
      offer: { is: null },
      ...(driveId ? { driveId } : {}),
    },
    select: {
      id: true,
      appliedAt: true,
      student: {
        select: {
          id: true,
          enrollmentNumber: true,
          firstName: true,
          lastName: true,
          branch: { select: { code: true } },
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
              academicYear: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { appliedAt: "desc" },
  });
}

/**
 * Phase 5: enforce `max_offers_per_student` and `min_ctc_difference` from the
 * policy engine (batch-scoped, falling back to institute-wide defaults).
 * Both are opt-in — a policy value of 0 disables that check.
 */
async function enforceOfferPolicies(
  studentId: string,
  data: Pick<CreateOfferInput, "ctc" | "type" | "category">
): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { batchId: true },
  });
  const batchId = student?.batchId ?? null;

  const [maxOffers, minCtcDiff] = await Promise.all([
    getPolicyValue<number>("max_offers_per_student", batchId),
    getPolicyValue<number>("min_ctc_difference", batchId),
  ]);

  const activeOffers = await prisma.offer.findMany({
    where: { studentId, status: { notIn: ["DECLINED", "WITHDRAWN"] } },
    select: { ctc: true, category: true, type: true },
  });

  if (maxOffers > 0 && activeOffers.length >= maxOffers) {
    throw new ValidationError(
      `This student already holds ${activeOffers.length} active offer(s), which meets the policy limit of ${maxOffers}. Withdraw or decline an existing offer first, or raise the "Maximum active offers per student" policy.`
    );
  }

  // Only compares full-time/PPO CTC offers within the same core/non-core
  // category — stipend-only internships and cross-category comparisons are
  // exempt, since they aren't measuring the same thing.
  const isComparableType = data.type === "FULL_TIME" || data.type === "PPO";
  if (minCtcDiff > 0 && data.ctc != null && isComparableType) {
    const comparable = activeOffers.filter(
      (o) =>
        o.ctc != null &&
        (o.type === "FULL_TIME" || o.type === "PPO") &&
        o.category === data.category
    );
    const bestExisting =
      comparable.length > 0 ? Math.max(...comparable.map((o) => o.ctc!)) : null;

    if (bestExisting != null && data.ctc - bestExisting < minCtcDiff) {
      throw new ValidationError(
        `This offer's CTC (${data.ctc} LPA) must exceed the student's best existing ${data.category} offer (${bestExisting} LPA) by at least ${minCtcDiff} LPA per the "Minimum CTC difference between offers" policy.`
      );
    }
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createOffer(
  data: CreateOfferInput,
  createdById: string,
  meta: RequestMeta = {}
): Promise<OfferWithDetails> {
  const application = await prisma.application.findUnique({
    where: { id: data.applicationId },
    include: { jobRole: { include: { drive: true } } },
  });

  if (!application) throw new NotFoundError("Application not found");

  if (application.status !== "SELECTED") {
    throw new ValidationError(
      "An offer can only be recorded for an application marked SELECTED"
    );
  }

  const existing = await prisma.offer.findUnique({
    where: { applicationId: data.applicationId },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("An offer already exists for this application");
  }

  await enforceOfferPolicies(application.studentId, data);

  const offer = await prisma.offer.create({
    data: {
      applicationId: application.id,
      studentId: application.studentId,
      driveId: application.driveId,
      jobRoleId: application.jobRoleId,
      companyId: application.jobRole.drive.companyId,
      category: data.category,
      type: data.type,
      isPPO: data.isPPO,
      ctc: data.ctc ?? null,
      stipend: data.stipend ?? null,
      ctcBreakdown: data.ctcBreakdown ?? null,
      location: data.location ?? null,
      offerDate: data.offerDate,
      joiningDate: data.joiningDate ?? null,
      createdById,
    },
    include: OFFER_INCLUDE,
  });

  await PlacementNotifications.offerRecorded(
    offer.studentId,
    offer.company.name,
    offer.jobRole.title,
    offer.ctc != null ? `${offer.ctc} LPA` : offer.stipend != null ? `${offer.stipend}/month` : "As per offer letter",
    offer.joiningDate ? offer.joiningDate.toLocaleDateString() : "To be confirmed"
  );

  await writeAuditLog({
    userId: createdById,
    action: "CREATE",
    entity: "Offer",
    entityId: offer.id,
    newValues: {
      applicationId: offer.applicationId,
      studentId: offer.studentId,
      companyId: offer.companyId,
      type: offer.type,
      category: offer.category,
      ctc: offer.ctc,
      stipend: offer.stipend,
      status: offer.status,
    },
    ...meta,
  });

  return offer;
}

// ─── Update details ───────────────────────────────────────────────────────────

export async function updateOffer(
  id: string,
  data: UpdateOfferInput,
  changedById: string,
  meta: RequestMeta = {}
): Promise<OfferWithDetails> {
  const before = await prisma.offer.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Offer not found");

  const joiningDate = data.joiningDate ?? before.joiningDate;
  const offerDate = data.offerDate ?? before.offerDate;
  if (joiningDate && joiningDate < offerDate) {
    throw new ValidationError("Joining date cannot be before the offer date");
  }

  const offer = await prisma.offer.update({
    where: { id },
    data: {
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.isPPO !== undefined ? { isPPO: data.isPPO } : {}),
      ...(data.ctc !== undefined ? { ctc: data.ctc } : {}),
      ...(data.stipend !== undefined ? { stipend: data.stipend } : {}),
      ...(data.ctcBreakdown !== undefined
        ? { ctcBreakdown: data.ctcBreakdown }
        : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.offerDate !== undefined ? { offerDate: data.offerDate } : {}),
      ...(data.joiningDate !== undefined
        ? { joiningDate: data.joiningDate }
        : {}),
    },
    include: OFFER_INCLUDE,
  });

  await writeAuditLog({
    userId: changedById,
    action: "UPDATE",
    entity: "Offer",
    entityId: id,
    oldValues: {
      category: before.category,
      type: before.type,
      ctc: before.ctc,
      stipend: before.stipend,
      joiningDate: before.joiningDate,
    },
    newValues: {
      category: offer.category,
      type: offer.type,
      ctc: offer.ctc,
      stipend: offer.stipend,
      joiningDate: offer.joiningDate,
    },
    ...meta,
  });

  return offer;
}

// ─── Status change ────────────────────────────────────────────────────────────

export async function updateOfferStatus(
  id: string,
  status: OfferStatus,
  changedById: string,
  note?: string,
  meta: RequestMeta = {}
): Promise<OfferWithDetails> {
  const before = await prisma.offer.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Offer not found");

  if (before.status === status) {
    throw new ValidationError(`Offer is already ${status}`);
  }

  const allowed = STATUS_TRANSITIONS[before.status];
  if (!allowed.includes(status)) {
    throw new ValidationError(
      allowed.length === 0
        ? `Offer is ${before.status} and can no longer change status`
        : `Cannot change offer status from ${before.status} to ${status}`
    );
  }

  const timestampField = STATUS_TIMESTAMP[status];

  const offer = await prisma.offer.update({
    where: { id },
    data: {
      status,
      statusNote: note ?? null,
      ...(timestampField ? { [timestampField]: new Date() } : {}),
    },
    include: OFFER_INCLUDE,
  });

  await writeAuditLog({
    userId: changedById,
    action: "STATUS_CHANGE",
    entity: "Offer",
    entityId: id,
    oldValues: { status: before.status },
    newValues: { status: offer.status, note: note ?? null },
    ...meta,
  });

  return offer;
}

// ─── Offer letter ─────────────────────────────────────────────────────────────

export async function uploadOfferLetter(
  id: string,
  file: File,
  changedById: string,
  meta: RequestMeta = {}
): Promise<OfferWithDetails> {
  const before = await prisma.offer.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Offer not found");

  if (file.type !== "application/pdf") {
    throw new ValidationError("Offer letter must be a PDF");
  }
  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    throw new ValidationError("Offer letter must be 10MB or smaller");
  }

  const storage = getStorageAdapter();
  const key = `offer-letters/${before.studentId}/${randomUUID()}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await storage.upload(key, buffer, file.type);

  // Remove the superseded letter only after the new one is safely stored.
  if (before.offerLetterKey) {
    try {
      await storage.delete(before.offerLetterKey);
    } catch (err) {
      console.warn("[Offer] Failed to delete previous offer letter:", err);
    }
  }

  const offer = await prisma.offer.update({
    where: { id },
    data: { offerLetterKey: key },
    include: OFFER_INCLUDE,
  });

  await writeAuditLog({
    userId: changedById,
    action: "UPDATE",
    entity: "Offer",
    entityId: id,
    oldValues: { offerLetterKey: before.offerLetterKey },
    newValues: { offerLetterKey: key },
    metadata: { fileName: file.name, sizeBytes: file.size },
    ...meta,
  });

  return offer;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getOfferStats(academicYear?: string) {
  const where: Prisma.OfferWhereInput = academicYear
    ? { drive: { academicYear } }
    : {};

  const [byStatus, byCategory, aggregate] = await Promise.all([
    prisma.offer.groupBy({ by: ["status"], where, _count: true }),
    prisma.offer.groupBy({ by: ["category"], where, _count: true }),
    prisma.offer.aggregate({
      where: { ...where, ctc: { not: null } },
      _avg: { ctc: true },
      _max: { ctc: true },
      _min: { ctc: true },
      _count: true,
    }),
  ]);

  return {
    total: byStatus.reduce((sum, r) => sum + r._count, 0),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
    byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r._count])),
    ctc: {
      average: aggregate._avg.ctc,
      highest: aggregate._max.ctc,
      lowest: aggregate._min.ctc,
      countWithCtc: aggregate._count,
    },
  };
}
