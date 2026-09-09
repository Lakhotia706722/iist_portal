/**
 * Compliance / Discipline service — Phase 5
 *
 * A student's compliance status (Eligible / Conditional / Restricted /
 * Placed / Debarred) is always DERIVED — from PolicyRule values and their
 * incident/attendance/document/SkillUp history — never stored directly.
 * The one exception a T&P admin can set is an explicit override, which is
 * itself audited and visibly distinguished from a computed status.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, ComplianceStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { writeAuditLog, type AuditParams } from "./audit.service";
import { getPolicyValue } from "./policy.service";
import { getStorageAdapter, buildStorageKey } from "@/lib/storage";
import type { IncidentInput, UpdateIncidentInput } from "@/lib/validations/compliance";

type RequestMeta = Pick<AuditParams, "ipAddress" | "userAgent">;

// ─── Incidents ────────────────────────────────────────────────────────────────

const INCIDENT_INCLUDE = {
  student: {
    select: {
      id: true,
      enrollmentNumber: true,
      firstName: true,
      lastName: true,
      branch: { select: { code: true } },
    },
  },
  company: { select: { id: true, name: true } },
  drive: { select: { id: true, title: true } },
} satisfies Prisma.DisciplineIncidentInclude;

export async function listIncidents(filters: {
  studentId?: string;
  companyId?: string;
  severity?: string;
  status?: string;
  violationType?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const where: Prisma.DisciplineIncidentWhereInput = {
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.severity ? { severity: filters.severity as any } : {}),
    ...(filters.status ? { status: filters.status as any } : {}),
    ...(filters.violationType ? { violationType: filters.violationType as any } : {}),
    ...(filters.search
      ? {
          OR: [
            { student: { enrollmentNumber: { contains: filters.search, mode: "insensitive" } } },
            { student: { firstName: { contains: filters.search, mode: "insensitive" } } },
            { student: { lastName: { contains: filters.search, mode: "insensitive" } } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [incidents, total] = await Promise.all([
    prisma.disciplineIncident.findMany({
      where,
      include: INCIDENT_INCLUDE,
      orderBy: { incidentDate: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.disciplineIncident.count({ where }),
  ]);

  return { incidents, total };
}

export async function getIncidentById(id: string) {
  const incident = await prisma.disciplineIncident.findUnique({
    where: { id },
    include: INCIDENT_INCLUDE,
  });
  if (!incident) throw new NotFoundError("Incident not found");
  return incident;
}

export async function createIncident(
  data: IncidentInput,
  reportedById: string,
  meta: RequestMeta = {}
) {
  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
    select: { id: true },
  });
  if (!student) throw new NotFoundError("Student not found");

  const incident = await prisma.disciplineIncident.create({
    data: {
      studentId: data.studentId,
      companyId: data.companyId || null,
      driveId: data.driveId || null,
      violationType: data.violationType,
      severity: data.severity,
      description: data.description,
      incidentDate: data.incidentDate,
      actionTaken: data.actionTaken ?? null,
      adminRemarks: data.adminRemarks ?? null,
      status: data.status,
      reportedById,
    },
    include: INCIDENT_INCLUDE,
  });

  await writeAuditLog({
    userId: reportedById,
    action: "CREATE",
    entity: "DisciplineIncident",
    entityId: incident.id,
    newValues: {
      studentId: incident.studentId,
      violationType: incident.violationType,
      severity: incident.severity,
      status: incident.status,
    },
    ...meta,
  });

  return incident;
}

export async function updateIncident(
  id: string,
  data: UpdateIncidentInput,
  changedById: string,
  meta: RequestMeta = {}
) {
  const before = await prisma.disciplineIncident.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Incident not found");

  const isResolving =
    data.status && ["RESOLVED", "DISMISSED"].includes(data.status) && before.status !== data.status;

  const incident = await prisma.disciplineIncident.update({
    where: { id },
    data: {
      ...data,
      ...(isResolving ? { resolvedById: changedById, resolvedAt: new Date() } : {}),
    },
    include: INCIDENT_INCLUDE,
  });

  await writeAuditLog({
    userId: changedById,
    action: "UPDATE",
    entity: "DisciplineIncident",
    entityId: id,
    oldValues: { status: before.status, severity: before.severity },
    newValues: { status: incident.status, severity: incident.severity },
    ...meta,
  });

  return incident;
}

export async function uploadIncidentDocument(
  id: string,
  file: File,
  actorId: string,
  meta: RequestMeta = {}
) {
  const incident = await prisma.disciplineIncident.findUnique({ where: { id } });
  if (!incident) throw new NotFoundError("Incident not found");

  if (file.size > 10 * 1024 * 1024) {
    throw new ValidationError("Supporting document must be 10MB or smaller");
  }
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new ValidationError("Supporting document must be a PDF or image");
  }

  const storage = getStorageAdapter();
  const key = buildStorageKey("incident-evidence", incident.studentId, file.name);
  await storage.upload(key, Buffer.from(await file.arrayBuffer()), file.type);

  if (incident.documentKey) {
    await storage.delete(incident.documentKey).catch(() => {});
  }

  const updated = await prisma.disciplineIncident.update({
    where: { id },
    data: { documentKey: key },
    include: INCIDENT_INCLUDE,
  });

  await writeAuditLog({
    userId: actorId,
    action: "UPDATE",
    entity: "DisciplineIncident",
    entityId: id,
    newValues: { documentKey: key },
    metadata: { fileName: file.name },
    ...meta,
  });

  return updated;
}

// ─── Compliance status derivation ──────────────────────────────────────────────

export interface ComplianceResult {
  status: ComplianceStatus;
  reasons: string[];
  isOverridden: boolean;
  override: { status: ComplianceStatus; reason: string; setById: string; createdAt: Date } | null;
  signals: {
    isDebarred: boolean;
    debarReason: string | null;
    hasActivePlacement: boolean;
    openIncidents: Array<{ id: string; severity: string; violationType: string }>;
    attendancePercentage: number | null;
    documentsVerified: boolean;
    skillUpAverage: number | null;
    skillUpRequired: boolean;
    minSkillUpScore: number;
    minAttendancePercentage: number;
    documentVerificationRequired: boolean;
  };
}

export async function getComplianceStatus(studentId: string): Promise<ComplianceResult> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: true,
      offers: { select: { status: true } },
      documents: { select: { status: true } },
      testResults: { select: { percentage: true } },
      complianceOverride: true,
    },
  });
  if (!student) throw new NotFoundError("Student not found");

  const batchId = student.batchId ?? null;
  const [minSkillUpScore, skillUpRequired, minAttendancePercentage, documentVerificationRequired] =
    await Promise.all([
      getPolicyValue<number>("min_skillup_score", batchId),
      getPolicyValue<boolean>("skillup_required", batchId),
      getPolicyValue<number>("min_attendance_percentage", batchId),
      getPolicyValue<boolean>("document_verification_required", batchId),
    ]);

  const openIncidents = await prisma.disciplineIncident.findMany({
    where: { studentId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
    select: { id: true, severity: true, violationType: true },
  });

  // Attendance across every placement round the student has been scheduled for.
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { roundParticipant: { application: { studentId } } },
    select: { status: true },
  });
  const attendancePercentage =
    attendanceRecords.length > 0
      ? Number(
          (
            (attendanceRecords.filter((a) => a.status === "PRESENT" || a.status === "LATE").length /
              attendanceRecords.length) *
            100
          ).toFixed(1)
        )
      : null;

  const documentsVerified =
    student.documents.length === 0 || student.documents.every((d) => d.status === "VERIFIED");

  const skillUpAverage =
    student.testResults.length > 0
      ? Number(
          (
            student.testResults.reduce((sum, r) => sum + r.percentage, 0) / student.testResults.length
          ).toFixed(1)
        )
      : null;

  const hasActivePlacement = student.offers.some(
    (o) => o.status === "ACCEPTED" || o.status === "JOINED"
  );

  const signals = {
    isDebarred: student.isDebarred,
    debarReason: student.debarReason,
    hasActivePlacement,
    openIncidents,
    attendancePercentage,
    documentsVerified,
    skillUpAverage,
    skillUpRequired,
    minSkillUpScore,
    minAttendancePercentage,
    documentVerificationRequired,
  };

  // ── Precedence: debarred > override > derived ──
  if (student.isDebarred) {
    return {
      status: "DEBARRED",
      reasons: [student.debarReason || "Student has been debarred by the placement cell."],
      isOverridden: false,
      override: null,
      signals,
    };
  }

  if (student.complianceOverride) {
    return {
      status: student.complianceOverride.status,
      reasons: [student.complianceOverride.reason],
      isOverridden: true,
      override: {
        status: student.complianceOverride.status,
        reason: student.complianceOverride.reason,
        setById: student.complianceOverride.setById,
        createdAt: student.complianceOverride.createdAt,
      },
      signals,
    };
  }

  const reasons: string[] = [];

  // A CRITICAL incident (e.g. fraud discovered after placement) surfaces as
  // RESTRICTED even for an already-placed student — deliberately checked
  // ahead of PLACED, since that severity is serious enough to flag
  // regardless of an existing offer. HIGH-severity incidents are checked
  // *after* PLACED: they still gate a student who hasn't been placed yet,
  // but don't retroactively unplace someone over a lesser issue once an
  // offer is already accepted/joined.
  const criticalIncidents = openIncidents.filter((i) => i.severity === "CRITICAL");
  if (criticalIncidents.length > 0) {
    reasons.push(`${criticalIncidents.length} open critical-severity incident(s) on record.`);
    return { status: "RESTRICTED", reasons, isOverridden: false, override: null, signals };
  }

  if (hasActivePlacement) {
    return { status: "PLACED", reasons: ["Has an accepted or joined offer."], isOverridden: false, override: null, signals };
  }

  const restrictiveIncidents = openIncidents.filter((i) => i.severity === "HIGH");
  if (restrictiveIncidents.length > 0) {
    reasons.push(`${restrictiveIncidents.length} open high-severity incident(s) on record.`);
    return { status: "RESTRICTED", reasons, isOverridden: false, override: null, signals };
  }

  if (
    minAttendancePercentage > 0 &&
    attendancePercentage != null &&
    attendancePercentage < minAttendancePercentage
  ) {
    reasons.push(
      `Placement-round attendance is ${attendancePercentage}%, below the required ${minAttendancePercentage}%.`
    );
    return { status: "RESTRICTED", reasons, isOverridden: false, override: null, signals };
  }

  const minorIncidents = openIncidents.filter((i) => i.severity === "LOW" || i.severity === "MEDIUM");
  if (minorIncidents.length > 0) {
    reasons.push(`${minorIncidents.length} open low/medium-severity incident(s) on record.`);
  }

  if (documentVerificationRequired && !documentsVerified) {
    reasons.push("Not all uploaded documents are verified.");
  }

  if (skillUpRequired && skillUpAverage == null) {
    reasons.push("No SkillUp results on record yet, and SkillUp is required.");
  } else if (minSkillUpScore > 0 && (skillUpAverage == null || skillUpAverage < minSkillUpScore)) {
    reasons.push(
      `SkillUp average is ${skillUpAverage ?? 0}%, below the required ${minSkillUpScore}%.`
    );
  }

  if (reasons.length > 0) {
    return { status: "CONDITIONAL", reasons, isOverridden: false, override: null, signals };
  }

  return { status: "ELIGIBLE", reasons: ["Meets all configured placement policy requirements."], isOverridden: false, override: null, signals };
}

// ─── Admin override ────────────────────────────────────────────────────────────

export async function setComplianceOverride(
  studentId: string,
  status: ComplianceStatus,
  reason: string,
  setById: string,
  meta: RequestMeta = {}
) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError("Student not found");

  const before = await prisma.complianceOverride.findUnique({ where: { studentId } });

  const override = await prisma.complianceOverride.upsert({
    where: { studentId },
    update: { status, reason, setById },
    create: { studentId, status, reason, setById },
  });

  await writeAuditLog({
    userId: setById,
    action: before ? "UPDATE" : "CREATE",
    entity: "ComplianceOverride",
    entityId: override.id,
    oldValues: before ? { status: before.status, reason: before.reason } : undefined,
    newValues: { studentId, status, reason },
    ...meta,
  });

  return override;
}

export async function clearComplianceOverride(
  studentId: string,
  actorId: string,
  meta: RequestMeta = {}
) {
  const existing = await prisma.complianceOverride.findUnique({ where: { studentId } });
  if (!existing) throw new NotFoundError("No active override for this student");

  await prisma.complianceOverride.delete({ where: { studentId } });

  await writeAuditLog({
    userId: actorId,
    action: "DELETE",
    entity: "ComplianceOverride",
    entityId: existing.id,
    oldValues: { status: existing.status, reason: existing.reason },
    metadata: { reason: "override cleared — status reverts to computed" },
    ...meta,
  });
}

/** Compliance status for many students at once (roster/analytics views). */
export async function getComplianceStatusBulk(
  studentIds: string[]
): Promise<Map<string, ComplianceResult>> {
  const results = await Promise.all(
    studentIds.map(async (id) => [id, await getComplianceStatus(id)] as const)
  );
  return new Map(results);
}
