/**
 * Test fixtures — DEV/DEMO/TEST ONLY. Never run against production.
 *
 * The 5 demo role accounts + one realistic student record (used for manual
 * dev exploration and as the basis the Phase 9-11 Playwright suite's own
 * separate e2e/seed-e2e.ts fixtures were modeled on, and what
 * scripts/verify-phase7.ts's own fixtures build on top of — its company
 * slug "isro" and recruiter@isro.gov.in login are load-bearing for that
 * script, so keep both exactly as-is here even though this data is fake;
 * ISRO recruiting from IIST is realistic, not a "Lorem Corp"-style
 * placeholder, so there was never a real reason to rename it). This is the
 * opposite of seed-reference-data.ts, which contains no accounts at all —
 * a real placement partner beyond this demo entry gets created for real
 * through the actual Admin UI, not this script.
 *
 * Guarded below so this can't be pointed at production by accident: it
 * refuses outright if NODE_ENV=production (no override — this check exists
 * specifically so a CI/deploy misconfiguration can't run it), and
 * separately requires both a `--confirm-test-only` flag AND a DATABASE_URL
 * that looks like a local/test database (host is localhost/127.0.0.1, or
 * the URL/db-name contains "test"/"dev"/"local") before proceeding — an
 * unrecognized host prints what it saw and stops rather than guessing.
 *
 * Run: npx tsx prisma/seed-test-fixtures.ts --confirm-test-only
 */

import { PrismaClient, Role, Gender, Category, ProfileStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

function assertSafeToRun() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ Refusing to run: NODE_ENV=production. This script creates fake accounts and must never touch a production database.");
    process.exit(1);
  }

  if (!process.argv.includes("--confirm-test-only")) {
    console.error("❌ Refusing to run without --confirm-test-only. This script creates fake demo accounts (Password@123 for every one of them) — it must only ever run against a local/test database.");
    console.error("   Run: npx tsx prisma/seed-test-fixtures.ts --confirm-test-only");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  let dbName = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    dbName = parsed.pathname.replace(/^\//, "");
  } catch {
    console.error("❌ Refusing to run: DATABASE_URL is not a parseable URL. Set it explicitly and re-run.");
    process.exit(1);
  }

  const looksLocalOrTest =
    ["localhost", "127.0.0.1", "postgres", "db"].includes(host) ||
    /test|dev|local|scratch/i.test(host) ||
    /test|dev|local|scratch/i.test(dbName);

  if (!looksLocalOrTest) {
    console.error(`❌ Refusing to run: DATABASE_URL points at host "${host}", database "${dbName}" — this doesn't look like a local/test database.`);
    console.error("   If this genuinely is a scratch/test environment, rename the database or host to include 'test'/'dev'/'local' so this check can recognize it safely.");
    process.exit(1);
  }

  console.log(`✓ Safety check passed — seeding fake test fixtures into "${dbName}" on host "${host}".`);
}

const prisma = new PrismaClient();

async function main() {
  assertSafeToRun();

  console.log("🌱 Seeding test fixtures (fake demo data)...");
  const HASH = await bcrypt.hash("Password@123", 12);

  // Reference data (departments/branches/batches) is NOT created here —
  // run seed-reference-data.ts first. These fixtures assume it already ran.
  const branchCSE = await prisma.branch.findUnique({ where: { code: "BTECH-CSE" } });
  const branchAE = await prisma.branch.findUnique({ where: { code: "BTECH-AE" } });
  const deptCS = await prisma.department.findUnique({ where: { code: "CSE" } });
  if (!branchCSE || !branchAE || !deptCS) {
    console.error("❌ Reference data not found (branches/departments). Run `npx tsx prisma/seed-reference-data.ts` first.");
    process.exit(1);
  }
  const batchCSE = await prisma.batch.findFirst({ where: { branchId: branchCSE.id } });
  const batchAE = await prisma.batch.findFirst({ where: { branchId: branchAE.id } });
  if (!batchCSE || !batchAE) {
    console.error("❌ No batches found for CSE/AE — run seed-reference-data.ts first.");
    process.exit(1);
  }

  // ── TP Admin ─────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: "tpadmin@iist.ac.in" },
    update: {},
    create: { name: "TP Admin", email: "tpadmin@iist.ac.in", passwordHash: HASH, role: Role.TP_ADMIN, isActive: true, mustChangePassword: false },
  });
  console.log("  ✓ TP Admin:", adminUser.email);

  // ── Faculty ──────────────────────────────────────────────────────────────
  const facultyUser = await prisma.user.upsert({
    where: { email: "faculty@iist.ac.in" },
    update: {},
    create: { name: "Dr. Priya Nair", email: "faculty@iist.ac.in", passwordHash: HASH, role: Role.FACULTY, isActive: true, mustChangePassword: false },
  });
  await prisma.facultyProfile.upsert({
    where: { userId: facultyUser.id },
    update: {},
    create: { userId: facultyUser.id, employeeId: "EMP001", departmentId: deptCS.id, designation: "Assistant Professor" },
  });
  console.log("  ✓ Faculty:", facultyUser.email);

  // ── HoD ──────────────────────────────────────────────────────────────────
  const hodUser = await prisma.user.upsert({
    where: { email: "hod@iist.ac.in" },
    update: {},
    create: { name: "Prof. Rajan Krishnan", email: "hod@iist.ac.in", passwordHash: HASH, role: Role.HOD, isActive: true, mustChangePassword: false },
  });
  await prisma.hodProfile.upsert({
    where: { userId: hodUser.id },
    update: {},
    create: { userId: hodUser.id, employeeId: "EMP002", departmentId: deptCS.id },
  });
  console.log("  ✓ HoD:", hodUser.email);

  // ── Company Rep (fake demo company row — a real placement partner gets
  // entered for real through the Admin UI, not this script; kept as
  // "isro"/recruiter@isro.gov.in since scripts/verify-phase7.ts depends on
  // this exact slug and login) ─────────────────────────────────────────────
  const demoCompany = await prisma.company.upsert({
    where: { slug: "isro" },
    update: {},
    create: { name: "ISRO", slug: "isro", industry: "SPACE", description: "Indian Space Research Organisation", isActive: true },
  });
  const companyUser = await prisma.user.upsert({
    where: { email: "recruiter@isro.gov.in" },
    update: {},
    create: { name: "Vikram Sharma", email: "recruiter@isro.gov.in", passwordHash: HASH, role: Role.COMPANY_REP, isActive: true, mustChangePassword: false },
  });
  await prisma.companyRepProfile.upsert({
    where: { userId: companyUser.id },
    update: { companyId: demoCompany.id },
    create: { userId: companyUser.id, companyName: demoCompany.name, designation: "HR Manager", companyId: demoCompany.id },
  });
  console.log("  ✓ Company Rep:", companyUser.email, "-> linked to", demoCompany.name);

  // ── Student (complete profile) ────────────────────────────────────────────
  const studentUser = await prisma.user.upsert({
    where: { email: "student@iist.ac.in" },
    update: {},
    create: { name: "Arjun Menon", email: "student@iist.ac.in", passwordHash: HASH, role: Role.STUDENT, isActive: true, mustChangePassword: false },
  });
  const studentRecord = await prisma.student.upsert({
    where: { enrollmentNumber: "IIST2021CS01" },
    update: {},
    create: {
      userId: studentUser.id, enrollmentNumber: "IIST2021CS01", branchId: branchCSE.id, batchId: batchCSE.id,
      profileStatus: ProfileStatus.PENDING_VERIFICATION, onboardingStep: 2,
      firstName: "Arjun", lastName: "Menon", dateOfBirth: new Date("2003-06-15"), gender: Gender.MALE, category: Category.GENERAL,
      nationality: "Indian", phoneNumber: "9876543210", currentAddress: "Hostel Block A, IIST Campus",
      currentCity: "Thiruvananthapuram", currentState: "Kerala", currentPincode: "695547",
      fatherName: "Suresh Menon", motherName: "Latha Menon", bloodGroup: "O+",
    },
  });

  const academicRecord = await prisma.academicRecord.upsert({
    where: { studentId: studentRecord.id },
    update: {},
    create: {
      studentId: studentRecord.id, tenthSchool: "Kendriya Vidyalaya No.1", tenthBoard: "CBSE", tenthYear: 2019, tenthPercentage: 94.2,
      twelfthSchool: "Kendriya Vidyalaya No.1", twelfthBoard: "CBSE", twelfthYear: 2021, twelfthPercentage: 96.0, twelfthStream: "Science",
      currentCgpa: 8.75, currentSemester: 7, totalBacklogs: 0, activeBacklogs: 0, jeeAdvancedRank: 412,
    },
  });

  const sgpaData = [
    { semester: 1, sgpa: 8.5 }, { semester: 2, sgpa: 8.8 }, { semester: 3, sgpa: 8.6 },
    { semester: 4, sgpa: 9.0 }, { semester: 5, sgpa: 8.9 }, { semester: 6, sgpa: 8.7 },
  ];
  for (const s of sgpaData) {
    await prisma.sgpaRecord.upsert({
      where: { academicRecordId_semester: { academicRecordId: academicRecord.id, semester: s.semester } },
      update: { sgpa: s.sgpa },
      create: { academicRecordId: academicRecord.id, semester: s.semester, sgpa: s.sgpa, backlogs: 0 },
    });
  }
  console.log("  ✓ Student:", studentUser.email, "(IIST2021CS01, profile complete)");

  // ── Student (incomplete — triggers onboarding redirect) ────────────────
  const newStudentUser = await prisma.user.upsert({
    where: { email: "newstudent@iist.ac.in" },
    update: {},
    create: { name: "New Student", email: "newstudent@iist.ac.in", passwordHash: HASH, role: Role.STUDENT, isActive: true, mustChangePassword: false },
  });
  await prisma.student.upsert({
    where: { enrollmentNumber: "IIST2024AE01" },
    update: {},
    create: { userId: newStudentUser.id, enrollmentNumber: "IIST2024AE01", branchId: branchAE.id, batchId: batchAE.id, profileStatus: ProfileStatus.INCOMPLETE, onboardingStep: 0 },
  });
  console.log("  ✓ New Student (incomplete):", newStudentUser.email, "(IIST2024AE01)");

  // ── Audit log entries ────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { userId: adminUser.id, action: "CREATE", entity: "User", entityId: studentUser.id, newValues: { role: "STUDENT" } },
    ],
    skipDuplicates: true,
  });

  console.log("\n✅ Test fixtures seed complete!\n");
  console.log("Demo accounts (all passwords: Password@123)");
  console.log("─────────────────────────────────────────────────────");
  console.log("Role         | Login ID                | Password");
  console.log("─────────────────────────────────────────────────────");
  console.log("TP Admin     | tpadmin@iist.ac.in      | Password@123");
  console.log("Faculty      | faculty@iist.ac.in      | Password@123");
  console.log("HoD          | hod@iist.ac.in          | Password@123");
  console.log("Company Rep  | recruiter@isro.gov.in   | Password@123");
  console.log("Student      | IIST2021CS01            | Password@123");
  console.log("New Student  | IIST2024AE01            | Password@123");
  console.log("─────────────────────────────────────────────────────");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
