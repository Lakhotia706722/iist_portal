import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAuditLog, type AuditParams } from "./audit.service";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { issuePasswordResetToken } from "@/lib/auth/password-reset";
import { getResumes } from "./resume.service";
import { getStorageAdapter } from "@/lib/storage";
import type {
  PersonalInfoInput,
  AcademicInfoInput,
} from "@/lib/validations/student";
import type {
  CreateStudentInput,
  StudentCsvRowInput,
} from "@/lib/validations/admin";

type RequestMeta = Pick<AuditParams, "ipAddress" | "userAgent">;

export async function savePersonalInfo(studentId: string, data: PersonalInfoInput, actorId: string) {
  const old = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });

  const student = await prisma.student.update({
    where: { id: studentId },
    data: {
      firstName: data.firstName,
      middleName: data.middleName || null,
      lastName: data.lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      category: data.category,
      religion: data.religion || null,
      nationality: data.nationality,
      motherTongue: data.motherTongue || null,
      aadharNumber: data.aadharNumber || null,
      personalEmail: data.personalEmail || null,
      phoneNumber: data.phoneNumber,
      alternatePhone: data.alternatePhone || null,
      currentAddress: data.currentAddress,
      currentCity: data.currentCity,
      currentState: data.currentState,
      currentPincode: data.currentPincode,
      permanentAddress: data.permanentAddress || null,
      permanentCity: data.permanentCity || null,
      permanentState: data.permanentState || null,
      permanentPincode: data.permanentPincode || null,
      fatherName: data.fatherName,
      fatherOccupation: data.fatherOccupation || null,
      fatherPhone: data.fatherPhone || null,
      motherName: data.motherName,
      motherOccupation: data.motherOccupation || null,
      motherPhone: data.motherPhone || null,
      annualFamilyIncome: data.annualFamilyIncome ?? null,
      bloodGroup: data.bloodGroup || null,
      passportNumber: data.passportNumber || null,
      onboardingStep: Math.max(old.onboardingStep, 1),
      profileStatus: old.onboardingStep >= 1 ? old.profileStatus : "INCOMPLETE",
    },
  });

  // Also update the User name
  await prisma.user.update({
    where: { id: actorId },
    data: { name: [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ") },
  });

  await writeAuditLog({
    userId: actorId,
    action: "UPDATE",
    entity: "Student",
    entityId: studentId,
    newValues: { section: "personal_info" },
  });

  return student;
}

export async function saveAcademicInfo(studentId: string, data: AcademicInfoInput, actorId: string) {
  const { sgpaRecords, ...academicData } = data;

  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });

  // Upsert the academic record
  const record = await prisma.academicRecord.upsert({
    where: { studentId },
    create: {
      studentId,
      tenthSchool: academicData.tenthSchool,
      tenthBoard: academicData.tenthBoard,
      tenthYear: academicData.tenthYear,
      tenthPercentage: academicData.tenthPercentage,
      twelfthSchool: academicData.twelfthSchool,
      twelfthBoard: academicData.twelfthBoard,
      twelfthYear: academicData.twelfthYear,
      twelfthPercentage: academicData.twelfthPercentage,
      twelfthStream: academicData.twelfthStream || null,
      diplomaInstitute: academicData.diplomaInstitute || null,
      diplomaBranch: academicData.diplomaBranch || null,
      diplomaYear: academicData.diplomaYear ?? null,
      diplomaPercentage: academicData.diplomaPercentage ?? null,
      currentCgpa: academicData.currentCgpa,
      currentSemester: academicData.currentSemester,
      totalBacklogs: academicData.totalBacklogs ?? 0,
      activeBacklogs: academicData.activeBacklogs ?? 0,
      jeeMainRank: academicData.jeeMainRank ?? null,
      jeeAdvancedRank: academicData.jeeAdvancedRank ?? null,
    },
    update: {
      tenthSchool: academicData.tenthSchool,
      tenthBoard: academicData.tenthBoard,
      tenthYear: academicData.tenthYear,
      tenthPercentage: academicData.tenthPercentage,
      twelfthSchool: academicData.twelfthSchool,
      twelfthBoard: academicData.twelfthBoard,
      twelfthYear: academicData.twelfthYear,
      twelfthPercentage: academicData.twelfthPercentage,
      twelfthStream: academicData.twelfthStream || null,
      currentCgpa: academicData.currentCgpa,
      currentSemester: academicData.currentSemester,
      totalBacklogs: academicData.totalBacklogs ?? 0,
      activeBacklogs: academicData.activeBacklogs ?? 0,
      jeeMainRank: academicData.jeeMainRank ?? null,
      jeeAdvancedRank: academicData.jeeAdvancedRank ?? null,
    },
  });

  // Replace all SGPA records
  await prisma.sgpaRecord.deleteMany({ where: { academicRecordId: record.id } });
  if (sgpaRecords.length > 0) {
    await prisma.sgpaRecord.createMany({
      data: sgpaRecords.map((r) => ({
        academicRecordId: record.id,
        semester: r.semester,
        sgpa: r.sgpa,
        backlogs: r.backlogs ?? 0,
      })),
    });
  }

  // Mark onboarding complete
  await prisma.student.update({
    where: { id: studentId },
    data: {
      onboardingStep: 2,
      profileStatus: "PENDING_VERIFICATION",
    },
  });

  await writeAuditLog({
    userId: actorId,
    action: "UPDATE",
    entity: "Student",
    entityId: studentId,
    newValues: { section: "academic_info", onboardingStep: 2 },
  });

  return record;
}

export async function getStudentProfile(studentId: string) {
  return prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      branch: { include: { department: true, course: true } },
      batch: true,
      academicRecord: { include: { sgpaRecords: { orderBy: { semester: "asc" } } } },
      user: { select: { name: true, email: true, lastLoginAt: true } },
    },
  });
}

// ─── Student provisioning (Phase 17 P4) ────────────────────────────────────
// No password is generated or emailed here — the account is created with an
// unusable random hash and mustChangePassword:true, and the student instead
// gets a "set your password" email via the same PasswordResetToken
// mechanism forgot-password uses (lib/auth/password-reset.ts). This is a
// locked decision: reusing that flow instead of a plaintext temp password.

/** A random hash nobody can log in with until the reset link is used. */
async function unusablePasswordHash(): Promise<string> {
  return bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
}

export async function createStudentAccount(
  data: CreateStudentInput,
  actorId: string,
  meta: RequestMeta = {}
) {
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) throw new ValidationError("A user with this email already exists");

  const existingStudent = await prisma.student.findUnique({
    where: { enrollmentNumber: data.enrollmentNumber },
  });
  if (existingStudent) throw new ValidationError("A student with this enrollment number already exists");

  const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
  if (!branch) throw new NotFoundError("Branch not found");

  const batch = await prisma.batch.findUnique({ where: { id: data.batchId } });
  if (!batch) throw new NotFoundError("Batch not found");
  if (batch.branchId !== data.branchId) {
    throw new ValidationError("Batch does not belong to the selected branch");
  }

  const passwordHash = await unusablePasswordHash();

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: "STUDENT",
      passwordHash,
      mustChangePassword: true,
      student: {
        create: {
          enrollmentNumber: data.enrollmentNumber,
          branchId: data.branchId,
          batchId: data.batchId,
        },
      },
    },
    select: { id: true, name: true, email: true, student: { select: { id: true, enrollmentNumber: true } } },
  });

  await writeAuditLog({
    userId: actorId,
    action: "CREATE",
    entity: "Student",
    entityId: user.student!.id,
    newValues: { enrollmentNumber: data.enrollmentNumber, email: data.email, branchId: data.branchId, batchId: data.batchId },
    ...meta,
  });

  // Best-effort, matching bulkCreateStudentAccounts below: the account is
  // already committed at this point, so a transient email failure must
  // not make account creation itself look like it failed to the admin —
  // it would already have succeeded, just silently, which is worse.
  await issuePasswordResetToken(user, { variant: "welcome" }).catch((err) =>
    console.error(`[createStudentAccount] Failed to send welcome email to ${user.email}:`, err)
  );

  return { id: user.student!.id, userId: user.id, name: user.name, email: user.email, enrollmentNumber: user.student!.enrollmentNumber };
}

export interface BulkStudentRowError {
  row: number;
  enrollmentNumber: string;
  reason: string;
}

/**
 * All-or-nothing bulk student creation — mirrors uploadResults() in
 * skillup.service.ts: every row is validated before anything is written,
 * and a single bad row rejects the whole batch with per-row errors.
 */
export async function bulkCreateStudentAccounts(
  rows: StudentCsvRowInput[],
  actorId: string,
  meta: RequestMeta = {}
): Promise<{ created: number; errors: BulkStudentRowError[] }> {
  const enrollments = rows.map((r) => r.enrollmentNumber.trim());
  const emails = rows.map((r) => r.email.trim().toLowerCase());
  const branchCodes = [...new Set(rows.map((r) => r.branchCode.trim().toUpperCase()))];

  const [existingStudents, existingUsers, branches] = await Promise.all([
    prisma.student.findMany({ where: { enrollmentNumber: { in: enrollments } }, select: { enrollmentNumber: true } }),
    prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    prisma.branch.findMany({ where: { code: { in: branchCodes } }, select: { id: true, code: true } }),
  ]);

  const existingEnrollments = new Set(existingStudents.map((s) => s.enrollmentNumber));
  const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
  const branchByCode = new Map(branches.map((b) => [b.code, b]));

  const batchByBranchAndYear = new Map<string, { id: string; branchId: string }>();
  if (branches.length > 0) {
    const batches = await prisma.batch.findMany({
      where: { branchId: { in: branches.map((b) => b.id) } },
      select: { id: true, branchId: true, academicYear: true },
    });
    for (const b of batches) batchByBranchAndYear.set(`${b.branchId}:${b.academicYear}`, b);
  }

  const errors: BulkStudentRowError[] = [];
  const seenEnrollments = new Set<string>();
  const seenEmails = new Set<string>();
  const resolved: Array<{ row: StudentCsvRowInput; branchId: string; batchId: string }> = [];

  rows.forEach((row, i) => {
    const rowNumber = i + 1;
    const enrollment = row.enrollmentNumber.trim();
    const email = row.email.trim().toLowerCase();
    const branchCode = row.branchCode.trim().toUpperCase();

    if (existingEnrollments.has(enrollment)) {
      errors.push({ row: rowNumber, enrollmentNumber: enrollment, reason: "A student with this enrollment number already exists" });
      return;
    }
    if (seenEnrollments.has(enrollment)) {
      errors.push({ row: rowNumber, enrollmentNumber: enrollment, reason: "Duplicate enrollment number in this upload" });
      return;
    }
    if (existingEmails.has(email)) {
      errors.push({ row: rowNumber, enrollmentNumber: enrollment, reason: "A user with this email already exists" });
      return;
    }
    if (seenEmails.has(email)) {
      errors.push({ row: rowNumber, enrollmentNumber: enrollment, reason: "Duplicate email in this upload" });
      return;
    }
    const branch = branchByCode.get(branchCode);
    if (!branch) {
      errors.push({ row: rowNumber, enrollmentNumber: enrollment, reason: `No branch found with code "${row.branchCode}"` });
      return;
    }
    const batch = batchByBranchAndYear.get(`${branch.id}:${row.batchAcademicYear}`);
    if (!batch) {
      errors.push({ row: rowNumber, enrollmentNumber: enrollment, reason: `No batch "${row.batchAcademicYear}" found for branch "${row.branchCode}"` });
      return;
    }

    seenEnrollments.add(enrollment);
    seenEmails.add(email);
    resolved.push({ row, branchId: branch.id, batchId: batch.id });
  });

  // All-or-nothing: a partial import would leave half the cohort without accounts.
  if (errors.length > 0) {
    return { created: 0, errors };
  }

  // bcrypt is async, so hashes must be computed up front — $transaction's
  // array form needs already-built Prisma promises, not async callbacks.
  const passwordHashes = await Promise.all(resolved.map(() => unusablePasswordHash()));

  const createdUsers = await prisma.$transaction(
    resolved.map(({ row, branchId, batchId }, i) =>
      prisma.user.create({
        data: {
          name: row.name,
          email: row.email.trim().toLowerCase(),
          role: "STUDENT",
          passwordHash: passwordHashes[i],
          mustChangePassword: true,
          student: {
            create: {
              enrollmentNumber: row.enrollmentNumber.trim(),
              branchId,
              batchId,
            },
          },
        },
        select: { id: true, name: true, email: true, student: { select: { id: true, enrollmentNumber: true } } },
      })
    )
  );

  // Accounts are committed at this point. Audit logging and welcome emails
  // are best-effort per row from here — a failure in either must not undo
  // the accounts already created, and writeAuditLog already swallows its
  // own errors (see audit.service.ts).
  await Promise.all(
    createdUsers.map((user) =>
      writeAuditLog({
        userId: actorId,
        action: "CREATE",
        entity: "Student",
        entityId: user.student!.id,
        newValues: { enrollmentNumber: user.student!.enrollmentNumber, email: user.email },
        ...meta,
      })
    )
  );

  await Promise.all(
    createdUsers.map((user) =>
      issuePasswordResetToken(user, { variant: "welcome" }).catch((err) =>
        console.error(`[bulkCreateStudentAccounts] Failed to send welcome email to ${user.email}:`, err)
      )
    )
  );

  return { created: createdUsers.length, errors: [] };
}

// ─── Admin student-detail overview (Phase 17 P5) ───────────────────────────
// Feeds the sections of /admin/students/[id] that don't already have a
// reusable component to embed (Applications, Offers, SkillUp results,
// Resumes) — deliberately unrestricted, matching the personal/academic
// profile view's admin-unmasked behavior (app/api/student/profile/career).

export async function getStudentAdminOverview(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, enrollmentNumber: true },
  });
  if (!student) throw new NotFoundError("Student not found");

  const storage = getStorageAdapter();

  const [applications, offers, testResults, mockInterviews, resumes] = await Promise.all([
    prisma.application.findMany({
      where: { studentId },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        jobRole: {
          select: {
            id: true,
            title: true,
            drive: { select: { id: true, title: true, status: true, company: { select: { name: true } } } },
          },
        },
      },
      orderBy: { appliedAt: "desc" },
    }),
    prisma.offer.findMany({
      where: { studentId },
      select: {
        id: true,
        category: true,
        type: true,
        ctc: true,
        stipend: true,
        status: true,
        offerDate: true,
        company: { select: { name: true } },
        jobRole: { select: { title: true } },
      },
      orderBy: { offerDate: "desc" },
    }),
    prisma.testResult.findMany({
      where: { studentId },
      select: {
        id: true,
        marksObtained: true,
        maxMarks: true,
        percentage: true,
        isPassed: true,
        createdAt: true,
        test: { select: { title: true, testType: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mockInterview.findMany({
      where: { studentId },
      select: {
        id: true,
        interviewerName: true,
        scheduledAt: true,
        type: true,
        status: true,
        result: { select: { overallScore: true } },
      },
      orderBy: { scheduledAt: "desc" },
    }),
    getResumes(studentId),
  ]);

  const resumesWithUrls = await Promise.all(
    resumes.map(async (r) => ({
      id: r.id,
      name: r.name,
      isDefault: r.isDefault,
      versionCount: r._count.versions,
      updatedAt: r.updatedAt,
      latestVersion: r.versions[0]
        ? {
            version: r.versions[0].version,
            createdAt: r.versions[0].createdAt,
            isGenerated: r.versions[0].isGenerated,
            fileUrl: r.versions[0].fileKey ? await storage.getSignedUrl(r.versions[0].fileKey) : null,
          }
        : null,
    }))
  );

  return { applications, offers, testResults, mockInterviews, resumes: resumesWithUrls };
}
