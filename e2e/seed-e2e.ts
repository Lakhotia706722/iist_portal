/**
 * Phase 9 — dedicated E2E fixture seed.
 *
 * Separate from prisma/seed.ts's demo accounts deliberately: Playwright
 * flows mutate real state (create offers, shortlist applications, etc.),
 * and reusing the shared demo student caused exactly this kind of
 * cross-script interference earlier (see the offer-limit collision fixed
 * in scripts/verify-phase7.ts). Every account/record here is `e2e-`
 * prefixed and upserted, so re-running this script (and the suite) is
 * idempotent and self-contained — it doesn't depend on prisma/seed.ts
 * having been run first, beyond the base Department/Branch/Batch/Course
 * rows, which it creates if missing.
 *
 * Run standalone: npx tsx e2e/seed-e2e.ts
 * (also invoked automatically by e2e/global-setup.ts before the suite)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Password@123";

async function main() {
  const HASH = await bcrypt.hash(PASSWORD, 12);

  // ── Departments / Courses / Branches / Batches (reuse if seed.ts already ran) ──
  const deptCS = await prisma.department.upsert({
    where: { code: "CSE" },
    update: {},
    create: { name: "Computer Science & Engineering", code: "CSE" },
  });
  const deptAE = await prisma.department.upsert({
    where: { code: "AE" },
    update: {},
    create: { name: "Aerospace Engineering", code: "AE" },
  });
  const course = await prisma.course.upsert({
    where: { code: "BTECH" },
    update: {},
    create: { name: "B.Tech", code: "BTECH", durationYears: 4 },
  });
  const branchCS = await prisma.branch.upsert({
    where: { code: "CSE" },
    update: {},
    create: { name: "Computer Science", code: "CSE", departmentId: deptCS.id, courseId: course.id },
  });
  const branchAE = await prisma.branch.upsert({
    where: { code: "AE" },
    update: {},
    create: { name: "Aerospace", code: "AE", departmentId: deptAE.id, courseId: course.id },
  });
  const batchCS =
    (await prisma.batch.findFirst({ where: { branchId: branchCS.id, academicYear: "2021-2025" } })) ??
    (await prisma.batch.create({
      data: { name: "2021-2025", academicYear: "2021-2025", branchId: branchCS.id, startYear: 2021, endYear: 2025 },
    }));
  const batchAE =
    (await prisma.batch.findFirst({ where: { branchId: branchAE.id, academicYear: "2021-2025" } })) ??
    (await prisma.batch.create({
      data: { name: "2021-2025", academicYear: "2021-2025", branchId: branchAE.id, startYear: 2021, endYear: 2025 },
    }));

  // ── Student A: rich profile, CSE ─────────────────────────────────────────
  const userA = await prisma.user.upsert({
    where: { email: "e2e-student-a@iist.ac.in" },
    update: {},
    create: {
      name: "E2E Student A", email: "e2e-student-a@iist.ac.in",
      passwordHash: HASH, role: "STUDENT", isActive: true, mustChangePassword: false,
    },
  });
  const studentA = await prisma.student.upsert({
    where: { userId: userA.id },
    update: {},
    create: {
      userId: userA.id, enrollmentNumber: "E2E2021CS01", branchId: branchCS.id, batchId: batchCS.id,
      profileStatus: "VERIFIED", onboardingStep: 2,
      firstName: "E2E", lastName: "Student A", dateOfBirth: new Date("2003-05-15"),
      gender: "MALE", category: "GENERAL", nationality: "Indian",
      personalEmail: "e2e.student.a.personal@example.com", phoneNumber: "9876543210",
      currentAddress: "123 Test St", currentCity: "Thiruvananthapuram", currentState: "Kerala", currentPincode: "695547",
      permanentAddress: "123 Test St", permanentCity: "Thiruvananthapuram", permanentState: "Kerala", permanentPincode: "695547",
      fatherName: "Test Father", motherName: "Test Mother",
    },
  });
  await prisma.academicRecord.upsert({
    where: { studentId: studentA.id },
    update: {},
    create: {
      studentId: studentA.id,
      tenthSchool: "Test School", tenthBoard: "CBSE", tenthYear: 2017, tenthPercentage: 92,
      twelfthSchool: "Test HSS", twelfthBoard: "CBSE", twelfthYear: 2019, twelfthPercentage: 90, twelfthStream: "Science",
      currentCgpa: 8.5, currentSemester: 7, totalBacklogs: 0, activeBacklogs: 0,
    },
  });
  await prisma.project.upsert({
    where: { id: "e2e-project-1" },
    update: {},
    create: {
      id: "e2e-project-1", studentId: studentA.id, title: "E2E Test Project",
      description: "A project seeded for Phase 9 functional verification.",
      techStack: ["TypeScript", "Next.js"], isOngoing: false,
      startDate: new Date("2024-01-01"), endDate: new Date("2024-06-01"),
    },
  });
  await prisma.internship.upsert({
    where: { id: "e2e-internship-1" },
    update: {},
    create: {
      id: "e2e-internship-1", studentId: studentA.id, company: "E2E Test Corp", role: "SDE Intern",
      startDate: new Date("2024-05-01"), endDate: new Date("2024-07-01"), isOngoing: false,
    },
  });
  await prisma.certification.upsert({
    where: { id: "e2e-certification-1" },
    update: {},
    create: {
      id: "e2e-certification-1", studentId: studentA.id, name: "E2E Test Certification",
      issuingOrg: "Test Issuer", issueDate: new Date("2024-01-01"), doesNotExpire: true,
    },
  });
  const skill = await prisma.skill.findFirst({ where: { name: "JavaScript" } })
    ?? await prisma.skill.create({ data: { name: "JavaScript", category: "PROGRAMMING" } });
  await prisma.studentSkill.upsert({
    where: { studentId_skillId: { studentId: studentA.id, skillId: skill.id } },
    update: {},
    create: { studentId: studentA.id, skillId: skill.id, level: "ADVANCED" },
  });
  await prisma.resume.upsert({
    where: { id: "e2e-resume-a" },
    update: {},
    create: { id: "e2e-resume-a", studentId: studentA.id, name: "E2E Resume", isDefault: true },
  });
  await prisma.notification.upsert({
    where: { id: "e2e-notification-a" },
    update: {},
    create: {
      id: "e2e-notification-a", userId: userA.id, subject: "Welcome to the E2E fixture",
      message: "This notification was seeded for Phase 9 functional verification.",
      category: "general",
    },
  });

  // ── Student B: minimal profile, AE (isolation checks) ───────────────────
  const userB = await prisma.user.upsert({
    where: { email: "e2e-student-b@iist.ac.in" },
    update: {},
    create: {
      name: "E2E Student B", email: "e2e-student-b@iist.ac.in",
      passwordHash: HASH, role: "STUDENT", isActive: true, mustChangePassword: false,
    },
  });
  const studentB = await prisma.student.upsert({
    where: { userId: userB.id },
    update: {},
    create: {
      userId: userB.id, enrollmentNumber: "E2E2021AE01", branchId: branchAE.id, batchId: batchAE.id,
      profileStatus: "INCOMPLETE", onboardingStep: 2,
      firstName: "E2E", lastName: "Student B",
    },
  });

  // ── Faculty / HODs / Admin (CSE + AE, for cross-department isolation) ───
  const facultyUser = await prisma.user.upsert({
    where: { email: "e2e-faculty@iist.ac.in" },
    update: {},
    create: { name: "E2E Faculty", email: "e2e-faculty@iist.ac.in", passwordHash: HASH, role: "FACULTY", isActive: true, mustChangePassword: false },
  });
  await prisma.facultyProfile.upsert({
    where: { userId: facultyUser.id },
    update: { departmentId: deptCS.id },
    create: { userId: facultyUser.id, employeeId: "E2E-FAC-01", departmentId: deptCS.id, designation: "Assistant Professor" },
  });

  // HodProfile.departmentId is unique (one HOD per department) — reuse the
  // existing per-department HOD accounts (from prisma/seed.ts and an
  // earlier phase's verify script) rather than fighting that constraint
  // with fresh e2e-prefixed ones. Password reset to the standard E2E one so
  // login is predictable regardless of what created them originally.
  const hodUser = await prisma.user.upsert({
    where: { email: "hod@iist.ac.in" },
    update: { passwordHash: HASH },
    create: { name: "HOD CSE", email: "hod@iist.ac.in", passwordHash: HASH, role: "HOD", isActive: true, mustChangePassword: false },
  });
  await prisma.hodProfile.upsert({
    where: { userId: hodUser.id },
    update: {},
    create: { userId: hodUser.id, employeeId: "E2E-HOD-01", departmentId: deptCS.id },
  });

  const hodAeUser = await prisma.user.upsert({
    where: { email: "hod-ae-verify@iist.ac.in" },
    update: { passwordHash: HASH },
    create: { name: "HOD AE", email: "hod-ae-verify@iist.ac.in", passwordHash: HASH, role: "HOD", isActive: true, mustChangePassword: false },
  });
  await prisma.hodProfile.upsert({
    where: { userId: hodAeUser.id },
    update: {},
    create: { userId: hodAeUser.id, employeeId: "E2E-HOD-02", departmentId: deptAE.id },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "e2e-admin@iist.ac.in" },
    update: {},
    create: { name: "E2E Admin", email: "e2e-admin@iist.ac.in", passwordHash: HASH, role: "TP_ADMIN", isActive: true, mustChangePassword: false },
  });

  // ── Two companies + reps (cross-company isolation) ──────────────────────
  const companyA = await prisma.company.upsert({
    where: { slug: "e2e-company-a" },
    update: {},
    create: { name: "E2E Company A", slug: "e2e-company-a", industry: "TECHNOLOGY", isActive: true },
  });
  const companyB = await prisma.company.upsert({
    where: { slug: "e2e-company-b" },
    update: {},
    create: { name: "E2E Company B", slug: "e2e-company-b", industry: "FINANCE", isActive: true },
  });
  const repAUser = await prisma.user.upsert({
    where: { email: "e2e-rep-a@example.com" },
    update: {},
    create: { name: "E2E Rep A", email: "e2e-rep-a@example.com", passwordHash: HASH, role: "COMPANY_REP", isActive: true, mustChangePassword: false },
  });
  await prisma.companyRepProfile.upsert({
    where: { userId: repAUser.id },
    update: { companyId: companyA.id },
    create: { userId: repAUser.id, companyName: companyA.name, companyId: companyA.id },
  });
  const repBUser = await prisma.user.upsert({
    where: { email: "e2e-rep-b@example.com" },
    update: {},
    create: { name: "E2E Rep B", email: "e2e-rep-b@example.com", passwordHash: HASH, role: "COMPANY_REP", isActive: true, mustChangePassword: false },
  });
  await prisma.companyRepProfile.upsert({
    where: { userId: repBUser.id },
    update: { companyId: companyB.id },
    create: { userId: repBUser.id, companyName: companyB.name, companyId: companyB.id },
  });

  // ── A published drive under Company A + role + eligibility rule, so
  // Student A has something real to browse/apply to via the actual UI. ────
  // listActiveOpportunities() requires applicationCloseAt in the future —
  // a null value never satisfies its `gt: new Date()` filter, so a drive
  // with no close date simply never appears as a browsable opportunity.
  const futureCloseDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const drive = await prisma.placementDrive.upsert({
    where: { id: "e2e-drive-1" },
    update: { status: "APPLICATIONS_OPEN", applicationCloseAt: futureCloseDate },
    create: {
      id: "e2e-drive-1", companyId: companyA.id, title: "E2E Test Drive",
      academicYear: "2025-2026", status: "APPLICATIONS_OPEN", createdById: adminUser.id,
      applicationCloseAt: futureCloseDate,
    },
  });
  const jobRole = await prisma.jobRole.upsert({
    where: { id: "e2e-role-1" },
    update: {},
    create: { id: "e2e-role-1", driveId: drive.id, title: "E2E Software Engineer", ctcMin: 8, ctcMax: 12, openings: 3 },
  });
  await prisma.eligibilityRule.upsert({
    where: { id: "e2e-eligibility-1" },
    update: {},
    create: { id: "e2e-eligibility-1", jobRoleId: jobRole.id, field: "CGPA", operator: "GTE", value: "7", label: "Min CGPA 7.0", isActive: true },
  });

  // ── A second, already-SHORTLISTED application/drive so route-crawl has
  // real content in "My Applications" without depending on the apply-flow
  // test having run first. ─────────────────────────────────────────────────
  const resume = await prisma.resume.findFirstOrThrow({ where: { studentId: studentA.id } });
  const resumeVersion = await prisma.resumeVersion.upsert({
    where: { id: "e2e-resume-version-a" },
    update: {},
    create: { id: "e2e-resume-version-a", resumeId: resume.id, version: 1, isGenerated: true },
  });
  const driveShortlisted = await prisma.placementDrive.upsert({
    where: { id: "e2e-drive-shortlisted" },
    update: {},
    create: {
      id: "e2e-drive-shortlisted", companyId: companyB.id, title: "E2E Shortlisted Drive",
      academicYear: "2025-2026", status: "APPLICATIONS_OPEN", createdById: adminUser.id,
    },
  });
  const jobRoleShortlisted = await prisma.jobRole.upsert({
    where: { id: "e2e-role-shortlisted" },
    update: {},
    create: { id: "e2e-role-shortlisted", driveId: driveShortlisted.id, title: "E2E Analyst", ctcMin: 6, ctcMax: 9 },
  });
  await prisma.application.upsert({
    where: { id: "e2e-application-shortlisted" },
    update: { status: "SHORTLISTED" },
    create: {
      id: "e2e-application-shortlisted", studentId: studentA.id, driveId: driveShortlisted.id,
      jobRoleId: jobRoleShortlisted.id, status: "SHORTLISTED", resumeVersionId: resumeVersion.id,
    },
  });

  // ── A SkillUp test + result for Student A ────────────────────────────────
  const testType = await prisma.testType.upsert({
    where: { slug: "e2e-aptitude" },
    update: {},
    create: { name: "E2E Aptitude", slug: "e2e-aptitude", isActive: true, sortOrder: 99 },
  });
  const test = await prisma.test.upsert({
    where: { id: "e2e-test-1" },
    update: {},
    create: {
      id: "e2e-test-1", title: "E2E Fixture Aptitude Test", testTypeId: testType.id,
      scheduledAt: new Date(), maxMarks: 100, passingMarks: 40, createdById: facultyUser.id, status: "COMPLETED",
    },
  });
  await prisma.testParticipant.upsert({
    where: { testId_studentId: { testId: test.id, studentId: studentA.id } },
    update: {},
    create: { testId: test.id, studentId: studentA.id },
  });
  await prisma.testResult.upsert({
    where: { testId_studentId: { testId: test.id, studentId: studentA.id } },
    update: {},
    create: {
      testId: test.id, studentId: studentA.id, marksObtained: 78, maxMarks: 100, percentage: 78,
      isPassed: true, recordedById: facultyUser.id,
    },
  });

  console.log("✅ E2E fixtures ready");
  console.log("  Student A (rich, CSE):", userA.email, "/", studentA.enrollmentNumber);
  console.log("  Student B (minimal, AE):", userB.email, "/", studentB.enrollmentNumber);
  console.log("  Faculty (CSE):", facultyUser.email);
  console.log("  HOD (CSE):", hodUser.email, " | HOD (AE):", hodAeUser.email);
  console.log("  Admin:", adminUser.email);
  console.log("  Company Rep A (Company A):", repAUser.email, " | Rep B (Company B):", repBUser.email);
  console.log(`  All passwords: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
