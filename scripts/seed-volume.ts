/**
 * Phase 11 — P3 data-volume seed.
 *
 * Seeds a batch-realistic volume of data so pagination, exports, search,
 * the audit log viewer, and analytics aggregation can be checked against
 * real row counts instead of a handful of fixtures:
 *   - 220 students (mix of CSE/AE), each with an AcademicRecord.
 *   - One drive with 120 applications against a single job role (to
 *     exceed the shortlisting table's 100-row page size).
 *   - 3,000 AuditLog rows.
 *
 * Idempotent: re-running clears its own `E2E Volume ...`-prefixed rows
 * first. Run standalone: npx tsx scripts/seed-volume.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Seeding volume dataset ===");
  const hash = await bcrypt.hash("Password@123", 4); // low cost factor — this is dev-only bulk fixture data, not real credentials

  const branchCS = await prisma.branch.findUniqueOrThrow({ where: { code: "CSE" } });
  const branchAE = await prisma.branch.findUniqueOrThrow({ where: { code: "AE" } });
  const batchCS = await prisma.batch.findFirstOrThrow({ where: { branchId: branchCS.id, academicYear: "2021-2025" } });
  const batchAE = await prisma.batch.findFirstOrThrow({ where: { branchId: branchAE.id, academicYear: "2021-2025" } });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "TP_ADMIN" } });

  // ── Clean up any previous run ──────────────────────────────────────────
  const priorUsers = await prisma.user.findMany({ where: { email: { contains: "e2e-volume-" } }, select: { id: true } });
  const priorStudents = await prisma.student.findMany({ where: { userId: { in: priorUsers.map((u) => u.id) } }, select: { id: true } });
  await prisma.application.deleteMany({ where: { studentId: { in: priorStudents.map((s) => s.id) } } });
  await prisma.academicRecord.deleteMany({ where: { studentId: { in: priorStudents.map((s) => s.id) } } });
  await prisma.student.deleteMany({ where: { id: { in: priorStudents.map((s) => s.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: priorUsers.map((u) => u.id) } } });
  await prisma.company.deleteMany({ where: { name: "E2E Volume Co" } });
  await prisma.auditLog.deleteMany({ where: { metadata: { path: ["seedTag"], equals: "e2e-volume" } } });

  // ── 220 students ────────────────────────────────────────────────────────
  const STUDENT_COUNT = 220;
  console.log(`Creating ${STUDENT_COUNT} students...`);
  const studentIds: string[] = [];
  for (let i = 0; i < STUDENT_COUNT; i++) {
    const branch = i % 2 === 0 ? branchCS : branchAE;
    const batch = i % 2 === 0 ? batchCS : batchAE;
    const user = await prisma.user.create({
      data: {
        name: `E2E Volume Student ${i}`,
        email: `e2e-volume-student-${i}@iist.ac.in`,
        passwordHash: hash,
        role: "STUDENT",
        isActive: true,
      },
    });
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        enrollmentNumber: `E2EVOL${String(i).padStart(4, "0")}`,
        branchId: branch.id,
        batchId: batch.id,
        onboardingStep: 2,
        firstName: "E2E",
        lastName: `Volume ${i}`,
      },
    });
    await prisma.academicRecord.create({
      data: { studentId: student.id, currentCgpa: 6 + (i % 40) / 10, currentSemester: 6 },
    });
    studentIds.push(student.id);
  }

  // ── One drive, 120 applications against a single job role ──────────────
  console.log("Creating drive with 120 applications...");
  const company = await prisma.company.create({
    data: { name: "E2E Volume Co", slug: `e2e-volume-co-${Date.now()}`, industry: "TECHNOLOGY", isActive: true },
  });
  const drive = await prisma.placementDrive.create({
    data: {
      companyId: company.id,
      title: "E2E Volume Drive",
      academicYear: "2025-2026",
      status: "APPLICATIONS_CLOSED",
      createdById: admin.id,
    },
  });
  const jobRole = await prisma.jobRole.create({ data: { driveId: drive.id, title: "E2E Volume Role" } });

  const APPLICANT_COUNT = 120;
  await prisma.application.createMany({
    data: studentIds.slice(0, APPLICANT_COUNT).map((studentId) => ({
      studentId,
      driveId: drive.id,
      jobRoleId: jobRole.id,
      status: "APPLIED" as const,
    })),
  });

  // ── 3,000 audit log rows ────────────────────────────────────────────────
  console.log("Creating 3,000 audit log rows...");
  const actions = ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"] as const;
  const entities = ["Application", "Company", "PlacementDrive", "Offer", "Student"];
  const AUDIT_COUNT = 3000;
  const BATCH = 500;
  for (let start = 0; start < AUDIT_COUNT; start += BATCH) {
    const rows = Array.from({ length: Math.min(BATCH, AUDIT_COUNT - start) }, (_, j) => {
      const i = start + j;
      return {
        userId: admin.id,
        action: actions[i % actions.length],
        entity: entities[i % entities.length],
        entityId: `e2e-volume-fake-${i}`,
        metadata: { seedTag: "e2e-volume", i },
        createdAt: new Date(Date.now() - i * 60_000),
      };
    });
    await prisma.auditLog.createMany({ data: rows });
  }

  console.log(`=== Done: ${STUDENT_COUNT} students, ${APPLICANT_COUNT} applications on drive ${drive.id}, ${AUDIT_COUNT} audit rows ===`);
  console.log(`Drive id: ${drive.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
