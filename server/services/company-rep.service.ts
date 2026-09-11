/**
 * Company Rep Portal — Phase 7
 *
 * Every function here takes the caller's own `companyId` (resolved once via
 * `getCompanyIdForRep()`, never trusted from a client-supplied value) and
 * enforces it at the Prisma query level — a company rep can only ever see
 * drives, applicants, and offers that belong to their own company.
 *
 * The applicant view in particular is a deliberately narrow `select`, not an
 * `include` of the full Student/Application records: a company rep must see
 * enough to run their own drive (name, branch, batch, resume, application +
 * round status) and nothing else — no contact/family/identity PII, no other
 * applications the student has made elsewhere, no internal admin notes. See
 * `APPLICANT_SELECT` below for the exact allowlist and ARCHITECTURE.md for
 * the reasoning.
 */

import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { getStorageAdapter } from "@/lib/storage";
import { listOffers, updateOfferStatus, type OfferWithDetails } from "./offer.service";
import type { OfferStatus } from "@prisma/client";

// ─── Scope resolution ──────────────────────────────────────────────────────

/**
 * Resolves the Company a rep is scoped to. Throws rather than returning
 * null so every call site fails closed — a rep whose account hasn't been
 * linked to a Company yet sees a clear error, never an unscoped fallback.
 */
export async function getCompanyIdForRep(userId: string): Promise<string> {
  const profile = await prisma.companyRepProfile.findUnique({
    where: { userId },
    select: { companyId: true },
  });
  if (!profile) {
    throw new ForbiddenError("No company rep profile found for this account");
  }
  if (!profile.companyId) {
    throw new ValidationError(
      "Your account isn't linked to a company yet — contact the placement cell admin to complete setup."
    );
  }
  return profile.companyId;
}

/**
 * Guards the two admin offer-write routes (status change, letter upload)
 * against the pre-existing gap where `offer:write` — which COMPANY_REP
 * legitimately needs — carried no ownership check at all: any company rep
 * could previously change the status of, or upload a letter for, *any*
 * company's offer. A no-op for every other role (they don't hit this path).
 */
export async function assertOfferOwnedByCallerIfCompanyRep(
  offerId: string,
  actor: { id: string; role?: string }
): Promise<void> {
  if (actor.role !== "COMPANY_REP") return;
  const companyId = await getCompanyIdForRep(actor.id);
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { companyId: true } });
  if (!offer || offer.companyId !== companyId) {
    throw new NotFoundError("Offer not found");
  }
}

/** Confirms a drive belongs to the given company; throws NotFoundError otherwise (not 403 — a rep has no legitimate reason to learn a foreign drive ID even exists). */
async function assertDriveOwnedByCompany(driveId: string, companyId: string) {
  const drive = await prisma.placementDrive.findUnique({
    where: { id: driveId },
    select: { id: true, companyId: true },
  });
  if (!drive || drive.companyId !== companyId) {
    throw new NotFoundError("Placement drive not found");
  }
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface CompanyRepDashboard {
  company: { id: string; name: string; industry: string };
  drives: {
    active: number;
    upcoming: number;
    past: number;
  };
  driveSummaries: Array<{
    id: string;
    title: string;
    status: string;
    academicYear: string;
    applicantCount: number;
    shortlistedCount: number;
    selectedCount: number;
    upcomingRounds: Array<{ id: string; title: string; scheduledAt: Date | null }>;
  }>;
}

const ACTIVE_DRIVE_STATUSES = ["PUBLISHED", "APPLICATIONS_OPEN", "APPLICATIONS_CLOSED", "IN_PROGRESS"];

export async function getCompanyRepDashboard(companyId: string): Promise<CompanyRepDashboard> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, industry: true },
  });
  if (!company) throw new NotFoundError("Company not found");

  const drives = await prisma.placementDrive.findMany({
    where: { companyId },
    select: {
      id: true,
      title: true,
      status: true,
      academicYear: true,
      _count: { select: { applications: true } },
      rounds: {
        where: { scheduledAt: { gte: new Date() } },
        select: { id: true, title: true, scheduledAt: true },
        orderBy: { scheduledAt: "asc" },
        take: 3,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const [active, upcoming, past] = [
    drives.filter((d) => ACTIVE_DRIVE_STATUSES.includes(d.status)).length,
    drives.filter((d) => d.status === "DRAFT").length,
    drives.filter((d) => d.status === "COMPLETED" || d.status === "CANCELLED").length,
  ];

  const driveSummaries = await Promise.all(
    drives.map(async (d) => {
      const [shortlistedCount, selectedCount] = await Promise.all([
        prisma.application.count({
          where: {
            jobRole: { driveId: d.id },
            status: { in: ["SHORTLISTED", "WRITTEN_TEST", "TECHNICAL_ROUND", "HR_ROUND", "FINAL_ROUND", "SELECTED"] },
          },
        }),
        prisma.application.count({ where: { jobRole: { driveId: d.id }, status: "SELECTED" } }),
      ]);
      return {
        id: d.id,
        title: d.title,
        status: d.status,
        academicYear: d.academicYear,
        applicantCount: d._count.applications,
        shortlistedCount,
        selectedCount,
        upcomingRounds: d.rounds,
      };
    })
  );

  return {
    company,
    drives: { active, upcoming, past },
    driveSummaries,
  };
}

// ─── Drive detail (scoped) ─────────────────────────────────────────────────

export async function getDriveDetailForCompany(driveId: string, companyId: string) {
  const drive = await prisma.placementDrive.findUnique({
    where: { id: driveId },
    select: {
      id: true,
      companyId: true,
      title: true,
      status: true,
      academicYear: true,
      description: true,
      applicationOpenAt: true,
      applicationCloseAt: true,
      driveStartDate: true,
      driveEndDate: true,
      workMode: true,
      locations: true,
      jobRoles: {
        select: { id: true, title: true, ctcMin: true, ctcMax: true, openings: true, workMode: true },
      },
      rounds: {
        select: { id: true, title: true, roundNumber: true, scheduledAt: true, mode: true },
        orderBy: { roundNumber: "asc" },
      },
    },
  });
  if (!drive || drive.companyId !== companyId) {
    throw new NotFoundError("Placement drive not found");
  }
  const { companyId: _omit, ...rest } = drive;
  return rest;
}

// ─── Applicants (strict allowlist) ─────────────────────────────────────────

/**
 * The exact field allowlist for what a company rep may see about an
 * applicant to their own drive. Deliberately excludes: every PII field on
 * Student beyond name/branch/batch (no DOB, address, phone, family, aadhar,
 * religion, category, physical stats, passport — see Student model),
 * `Application.adminNote` and `.eligibilitySnapshot` (internal), any other
 * application the student has made (to this or another company), and
 * `RoundParticipant.remarks`/`.nextAction` (internal interviewer notes) —
 * only the pass/fail `result` and attendance are surfaced.
 */
const APPLICANT_SELECT = {
  id: true,
  status: true,
  appliedAt: true,
  jobRoleId: true,
  resumeVersion: { select: { id: true, fileKey: true, version: true } },
  student: {
    select: {
      id: true,
      enrollmentNumber: true,
      firstName: true,
      lastName: true,
      branch: { select: { name: true, code: true } },
      batch: { select: { name: true, academicYear: true } },
    },
  },
  roundParticipations: {
    select: {
      result: true,
      round: { select: { id: true, title: true, roundNumber: true, scheduledAt: true } },
      attendance: { select: { status: true } },
    },
    orderBy: { round: { roundNumber: "asc" as const } },
  },
} as const;

export interface CompanyApplicantFilters {
  jobRoleId?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listApplicantsForCompanyDrive(
  driveId: string,
  companyId: string,
  filters: CompanyApplicantFilters = {}
) {
  await assertDriveOwnedByCompany(driveId, companyId);

  const where = {
    jobRole: { driveId, ...(filters.jobRoleId ? { id: filters.jobRoleId } : {}) },
    ...(filters.status ? { status: filters.status as any } : {}),
    ...(filters.search
      ? {
          OR: [
            { student: { enrollmentNumber: { contains: filters.search, mode: "insensitive" as const } } },
            { student: { firstName: { contains: filters.search, mode: "insensitive" as const } } },
            { student: { lastName: { contains: filters.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where,
      select: APPLICANT_SELECT,
      orderBy: { appliedAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.application.count({ where }),
  ]);

  const storage = getStorageAdapter();
  const applicants = await Promise.all(
    rows.map(async (a) => ({
      applicationId: a.id,
      status: a.status,
      appliedAt: a.appliedAt,
      jobRoleId: a.jobRoleId,
      student: {
        id: a.student.id,
        name: [a.student.firstName, a.student.lastName].filter(Boolean).join(" ") || a.student.enrollmentNumber,
        enrollmentNumber: a.student.enrollmentNumber,
        branch: a.student.branch,
        batch: a.student.batch,
      },
      resumeUrl: a.resumeVersion?.fileKey ? await storage.getSignedUrl(a.resumeVersion.fileKey) : null,
      rounds: a.roundParticipations.map((rp) => ({
        roundId: rp.round.id,
        title: rp.round.title,
        roundNumber: rp.round.roundNumber,
        scheduledAt: rp.round.scheduledAt,
        result: rp.result,
        attendance: rp.attendance?.status ?? null,
      })),
    }))
  );

  return { applicants, total };
}

// ─── Offers (scoped) ────────────────────────────────────────────────────────

export async function listOffersForCompany(
  companyId: string,
  filters: { status?: string; driveId?: string; limit?: number; offset?: number } = {}
): Promise<{ offers: OfferWithDetails[]; total: number }> {
  return listOffers({ ...filters, companyId } as any);
}

export async function updateOfferStatusForCompany(
  offerId: string,
  companyId: string,
  status: OfferStatus,
  changedById: string,
  note?: string,
  meta: { ipAddress?: string; userAgent?: string } = {}
): Promise<OfferWithDetails> {
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { companyId: true } });
  if (!offer || offer.companyId !== companyId) {
    throw new NotFoundError("Offer not found");
  }
  return updateOfferStatus(offerId, status, changedById, note, meta);
}

// ─── Pre-placement talk (read-only for company reps) ───────────────────────

/**
 * Phase 7 decision: PPT authorship (create/edit, attachments) stays
 * admin-only — company reps don't hold drive:write, so the existing
 * `/api/admin/drives/[id]/ppt` write paths are already closed to them. Read
 * access is opened here: a rep naturally wants to see what's been shared
 * about their own drive's PPT (schedule, venue, attachments). Documented as
 * a deliberate choice, not an oversight.
 */
export async function getPrePlacementTalkForCompany(driveId: string, companyId: string) {
  await assertDriveOwnedByCompany(driveId, companyId);
  const talk = await prisma.prePlacementTalk.findUnique({ where: { driveId } });
  if (!talk) return null;

  const storage = getStorageAdapter();
  const attachmentUrls = await Promise.all(
    talk.attachmentKeys.map((key) => storage.getSignedUrl(key))
  );
  return { ...talk, attachmentUrls };
}
