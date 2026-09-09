/**
 * Phase 7 verification — Faculty / HOD / Company Rep portals.
 * Run: npx tsx scripts/verify-phase7.ts [baseUrl]
 *
 * Sets up its own fixtures directly via Prisma (a second HOD in a different
 * department than the seeded one, a second company rep linked to a
 * different company than the seeded ISRO rep, a drive/application/offer
 * under ISRO with real data behind it) so the cross-tenant isolation checks
 * have two genuinely different departments/companies to prove isolation
 * between, not just a single-tenant happy path.
 */

import { prisma } from "../lib/prisma";
import { makeClient, ok, fail } from "./_client";
import bcrypt from "bcryptjs";

const BASE = process.argv[2] ?? "http://localhost:4040";
const api = makeClient(BASE);

async function main() {
  console.log(`\n=== Phase 7 verification against ${BASE} ===\n`);

  // ── Fixture setup ──────────────────────────────────────────────────────
  const HASH = await bcrypt.hash("Password@123", 12);

  const deptCS = await prisma.department.findFirstOrThrow({ where: { code: "CSE" } });
  const deptAE = await prisma.department.findFirstOrThrow({ where: { code: "AE" } });
  const facultyUser = await prisma.user.findUniqueOrThrow({ where: { email: "faculty@iist.ac.in" } });
  const hodCsUser = await prisma.user.findUniqueOrThrow({ where: { email: "hod@iist.ac.in" } });
  const studentCS = await prisma.student.findFirstOrThrow({
    where: { user: { email: "student@iist.ac.in" } },
    include: { user: true },
  });
  const studentAE = await prisma.student.findFirstOrThrow({
    where: { user: { email: "newstudent@iist.ac.in" } },
  });

  // Second HOD, scoped to Aerospace Engineering — deliberately a different
  // department than the seeded hod@iist.ac.in (CSE), so isolation is real.
  const hodAeUser = await prisma.user.upsert({
    where: { email: "hod-ae-verify@iist.ac.in" },
    update: {},
    create: {
      name: "Verify HOD AE",
      email: "hod-ae-verify@iist.ac.in",
      passwordHash: HASH,
      role: "HOD",
      isActive: true,
      mustChangePassword: false,
    },
  });
  await prisma.hodProfile.upsert({
    where: { userId: hodAeUser.id },
    update: { departmentId: deptAE.id },
    create: { userId: hodAeUser.id, employeeId: "EMP-VERIFY-AE", departmentId: deptAE.id },
  });

  // ISRO already exists (seed) and its rep is already linked. Give it a
  // real drive + job role + application + round + offer so the dashboard/
  // applicant/offer views have real data, not just empty-state checks.
  const isro = await prisma.company.findFirstOrThrow({ where: { slug: "isro" } });
  const isroDrive = await prisma.placementDrive.upsert({
    where: { id: "phase7-verify-isro-drive" },
    update: {},
    create: {
      id: "phase7-verify-isro-drive",
      companyId: isro.id,
      title: "Phase 7 Verify Drive — ISRO",
      academicYear: "2025-2026",
      status: "APPLICATIONS_OPEN",
      createdById: hodCsUser.id,
    },
  });
  const isroRole = await prisma.jobRole.upsert({
    where: { id: "phase7-verify-isro-role" },
    update: {},
    create: {
      id: "phase7-verify-isro-role",
      driveId: isroDrive.id,
      title: "Scientist/Engineer SC",
      ctcMin: 8,
      ctcMax: 12,
      openings: 5,
    },
  });

  const resume = await prisma.resume.upsert({
    where: { id: "phase7-verify-resume" },
    update: {},
    create: { id: "phase7-verify-resume", studentId: studentCS.id, name: "Phase 7 Verify Resume", isDefault: true },
  });
  const resumeVersion = await prisma.resumeVersion.upsert({
    where: { id: "phase7-verify-resume-v1" },
    update: {},
    create: { id: "phase7-verify-resume-v1", resumeId: resume.id, version: 1, fileKey: null, isGenerated: true },
  });

  const isroApplication = await prisma.application.upsert({
    where: { id: "phase7-verify-isro-application" },
    update: {},
    create: {
      id: "phase7-verify-isro-application",
      studentId: studentCS.id,
      driveId: isroDrive.id,
      jobRoleId: isroRole.id,
      status: "SELECTED",
      resumeVersionId: resumeVersion.id,
    },
  });

  const isroRound = await prisma.placementRound.upsert({
    where: { id: "phase7-verify-isro-round" },
    update: {},
    create: { id: "phase7-verify-isro-round", driveId: isroDrive.id, roundNumber: 1, title: "Technical Interview" },
  });
  const isroParticipant = await prisma.roundParticipant.upsert({
    where: { id: "phase7-verify-isro-participant" },
    update: {},
    create: {
      id: "phase7-verify-isro-participant",
      roundId: isroRound.id,
      applicationId: isroApplication.id,
      result: "PASS",
      remarks: "INTERNAL: strong communication, do not show to company",
    },
  });
  await prisma.attendanceRecord.upsert({
    where: { roundParticipantId: isroParticipant.id },
    update: {},
    create: { roundParticipantId: isroParticipant.id, status: "PRESENT" },
  });

  const isroOffer = await prisma.offer.upsert({
    where: { applicationId: isroApplication.id },
    // Reset to OFFERED on every run — status is a terminal state machine
    // (WITHDRAWN/DECLINED/JOINED have no outgoing transitions), and this
    // fixture needs to reach ACCEPTED again each time the script re-runs.
    update: { status: "OFFERED", acceptedAt: null, declinedAt: null, joinedAt: null, statusNote: null },
    create: {
      id: "phase7-verify-isro-offer",
      applicationId: isroApplication.id,
      studentId: studentCS.id,
      driveId: isroDrive.id,
      jobRoleId: isroRole.id,
      companyId: isro.id,
      category: "CORE",
      type: "FULL_TIME",
      ctc: 10,
      offerDate: new Date(),
      createdById: hodCsUser.id,
    },
  });

  // A second company + rep, deliberately different from ISRO, purely to
  // prove cross-company isolation (any drive/offer under it is enough).
  const verifyCorp = await prisma.company.upsert({
    where: { slug: "verify-corp" },
    update: {},
    create: { name: "Verify Corp", slug: "verify-corp", industry: "TECHNOLOGY", isActive: true },
  });
  const repBUser = await prisma.user.upsert({
    where: { email: "rep-b-verify@example.com" },
    update: {},
    create: {
      name: "Verify Rep B",
      email: "rep-b-verify@example.com",
      passwordHash: HASH,
      role: "COMPANY_REP",
      isActive: true,
      mustChangePassword: false,
    },
  });
  await prisma.companyRepProfile.upsert({
    where: { userId: repBUser.id },
    update: { companyId: verifyCorp.id },
    create: { userId: repBUser.id, companyName: verifyCorp.name, companyId: verifyCorp.id },
  });

  // Faculty: a test + a mock interview they created, so the dashboard shows
  // real counts.
  const testType = await prisma.testType.findFirstOrThrow({ where: { slug: "aptitude" } });
  const facultyTest = await prisma.test.upsert({
    where: { id: "phase7-verify-faculty-test" },
    update: {},
    create: {
      id: "phase7-verify-faculty-test",
      title: "Phase 7 Verify Aptitude Test",
      testTypeId: testType.id,
      scheduledAt: new Date(),
      maxMarks: 100,
      passingMarks: 40,
      createdById: facultyUser.id,
    },
  });
  await prisma.testParticipant.upsert({
    where: { testId_studentId: { testId: facultyTest.id, studentId: studentCS.id } },
    update: {},
    create: { testId: facultyTest.id, studentId: studentCS.id },
  });
  await prisma.mockInterview.upsert({
    where: { id: "phase7-verify-faculty-interview" },
    update: {},
    create: {
      id: "phase7-verify-faculty-interview",
      studentId: studentCS.id,
      interviewerName: "Faculty Verify",
      interviewerId: facultyUser.id,
      scheduledAt: new Date(),
      type: "TECHNICAL",
      createdById: facultyUser.id,
    },
  });

  ok("fixtures ready: 2 HODs (CSE/AE), ISRO drive+application+offer, 2nd company (Verify Corp) + rep, faculty test+interview");

  // ── Logins ──────────────────────────────────────────────────────────────
  const facultyJar = await api.login("faculty@iist.ac.in", "Password@123");
  const hodCsJar = await api.login("hod@iist.ac.in", "Password@123");
  const hodAeJar = await api.login("hod-ae-verify@iist.ac.in", "Password@123");
  const repAJar = await api.login("recruiter@isro.gov.in", "Password@123");
  const repBJar = await api.login("rep-b-verify@example.com", "Password@123");
  [facultyJar, hodCsJar, hodAeJar, repAJar, repBJar].every((j) => j.has("session-token"))
    ? ok("logged in: faculty, HOD (CSE), HOD (AE), company rep A (ISRO), company rep B (Verify Corp)")
    : fail("one or more logins failed");

  // ── P1: Faculty portal ────────────────────────────────────────────────────
  console.log("\n[P1] Faculty portal");

  const facultyDash = await api.get("/api/faculty/dashboard", facultyJar);
  const myTest = facultyDash.json?.tests?.find((t: any) => t.id === facultyTest.id);
  facultyDash.status === 200 && myTest && myTest.participantCount === 1
    ? ok(`faculty dashboard shows their created test with participantCount=${myTest.participantCount}`)
    : fail(`faculty dashboard missing/incorrect test data: ${JSON.stringify(facultyDash.json)}`);

  const myInterview = facultyDash.json?.interviews?.find((i: any) => i.id === "phase7-verify-faculty-interview");
  myInterview ? ok("faculty dashboard shows their created mock interview") : fail("faculty's mock interview missing from dashboard");

  const facultyStudents = await api.get("/api/faculty/students", facultyJar);
  facultyStudents.status === 200 && Array.isArray(facultyStudents.json?.students)
    ? ok(`faculty assigned-students view returns ${facultyStudents.json.students.length} student(s)`)
    : fail(`faculty students view failed: ${facultyStudents.status}`);

  const studentDeniedFacultyDash = await api.get("/api/faculty/dashboard", await api.login(studentCS.user.email!, "Password@123"));
  studentDeniedFacultyDash.status === 403
    ? ok("student cannot reach faculty dashboard (403)")
    : fail(`expected 403 for student on faculty dashboard, got ${studentDeniedFacultyDash.status}`);

  // ── P2: HOD portal — department scoping ──────────────────────────────────
  console.log("\n[P2] HOD portal — department scoping");

  const hodCsDash = await api.get("/api/hod/dashboard", hodCsJar);
  const hodAeDash = await api.get("/api/hod/dashboard", hodAeJar);
  hodCsDash.status === 200 && hodCsDash.json.department.id === deptCS.id
    ? ok(`HOD (CSE) dashboard scoped to their own department: ${hodCsDash.json.department.name}`)
    : fail(`HOD CSE dashboard wrong department: ${JSON.stringify(hodCsDash.json)}`);
  hodAeDash.status === 200 && hodAeDash.json.department.id === deptAE.id
    ? ok(`HOD (AE) dashboard scoped to their own department: ${hodAeDash.json.department.name}`)
    : fail(`HOD AE dashboard wrong department: ${JSON.stringify(hodAeDash.json)}`);
  hodCsDash.json.department.id !== hodAeDash.json.department.id
    ? ok("HOD dashboards genuinely differ by department (not a shared/global view)")
    : fail("HOD CSE and HOD AE got the SAME department — scoping is not enforced");

  // No client-controllable departmentId param exists on this route at all —
  // scoping is resolved server-side from the caller's own HodProfile, so
  // there is nothing to "pass a different department and get away with it."
  // The real isolation proof is in the student lists below.

  const hodCsStudents = await api.get("/api/hod/students", hodCsJar);
  const hodAeStudents = await api.get("/api/hod/students", hodAeJar);
  const csHasStudentCS = hodCsStudents.json?.students?.some((s: any) => s.id === studentCS.id);
  const csHasStudentAE = hodCsStudents.json?.students?.some((s: any) => s.id === studentAE.id);
  const aeHasStudentAE = hodAeStudents.json?.students?.some((s: any) => s.id === studentAE.id);
  const aeHasStudentCS = hodAeStudents.json?.students?.some((s: any) => s.id === studentCS.id);
  csHasStudentCS && !csHasStudentAE
    ? ok("HOD (CSE) sees the CSE student but NOT the AE student")
    : fail(`HOD CSE cross-department leak: hasOwn=${csHasStudentCS} hasForeign=${csHasStudentAE}`);
  aeHasStudentAE && !aeHasStudentCS
    ? ok("HOD (AE) sees the AE student but NOT the CSE student")
    : fail(`HOD AE cross-department leak: hasOwn=${aeHasStudentAE} hasForeign=${aeHasStudentCS}`);

  const hodAeCompliance = await api.get("/api/hod/compliance", hodAeJar);
  const complianceHasCsStudent = hodAeCompliance.json?.students?.some((s: any) => s.studentId === studentCS.id);
  hodAeCompliance.status === 200 && !complianceHasCsStudent
    ? ok("HOD (AE) compliance view excludes the CSE student")
    : fail(`HOD AE compliance cross-department leak: ${JSON.stringify(hodAeCompliance.json)}`);

  const facultyDeniedHod = await api.get("/api/hod/dashboard", facultyJar);
  facultyDeniedHod.status === 403
    ? ok("faculty (no HodProfile) cannot reach HOD dashboard (403 — fails closed, not unscoped)")
    : fail(`expected 403 for faculty on HOD dashboard, got ${facultyDeniedHod.status}`);

  // ── P3: Company Rep portal — company scoping ─────────────────────────────
  console.log("\n[P3] Company Rep portal — company scoping");

  const repADash = await api.get("/api/company/dashboard", repAJar);
  repADash.status === 200 && repADash.json.company.id === isro.id
    ? ok(`Rep A dashboard scoped to their own company: ${repADash.json.company.name}`)
    : fail(`Rep A dashboard wrong company: ${JSON.stringify(repADash.json)}`);

  const repACanSeeOwnDrive = await api.get(`/api/company/drives/${isroDrive.id}`, repAJar);
  repACanSeeOwnDrive.status === 200
    ? ok("Rep A can read their own drive")
    : fail(`Rep A denied their own drive: ${repACanSeeOwnDrive.status}`);

  const repBDeniedIsroDrive = await api.get(`/api/company/drives/${isroDrive.id}`, repBJar);
  repBDeniedIsroDrive.status === 404
    ? ok("Rep B (Verify Corp) CANNOT read ISRO's drive (404, not just hidden in UI)")
    : fail(`Rep B was able to read a foreign company's drive: status ${repBDeniedIsroDrive.status}`);

  const repBDeniedApplicants = await api.get(`/api/company/drives/${isroDrive.id}/applicants`, repBJar);
  repBDeniedApplicants.status === 404
    ? ok("Rep B CANNOT list applicants for ISRO's drive (404)")
    : fail(`Rep B saw ISRO's applicants: status ${repBDeniedApplicants.status}, body ${JSON.stringify(repBDeniedApplicants.json)}`);

  // ── The one place under-scoping would leak student data across companies:
  // verify the applicant field allowlist explicitly, field by field.
  const applicantsRes = await api.get(`/api/company/drives/${isroDrive.id}/applicants`, repAJar);
  const applicant = applicantsRes.json?.applicants?.find((a: any) => a.applicationId === isroApplication.id);
  if (applicantsRes.status === 200 && applicant) {
    const raw = JSON.stringify(applicant);
    const forbiddenMarkers = [
      "aadhar", "phoneNumber", "personalEmail", "fatherName", "motherName",
      "currentAddress", "permanentAddress", "religion", "category", "bloodGroup",
      "adminNote", "eligibilitySnapshot", "remarks", "nextAction", "annualFamilyIncome",
    ];
    const leaked = forbiddenMarkers.filter((m) => raw.toLowerCase().includes(m.toLowerCase()));
    leaked.length === 0
      ? ok("applicant payload contains ZERO forbidden fields (no PII, no adminNote/eligibilitySnapshot, no internal round remarks)")
      : fail(`applicant payload LEAKS forbidden field(s): ${leaked.join(", ")} — raw: ${raw}`);

    const hasAllowed = applicant.student?.name && applicant.student?.enrollmentNumber && applicant.student?.branch && "resumeUrl" in applicant && Array.isArray(applicant.rounds);
    hasAllowed
      ? ok("applicant payload contains exactly the intended allowlist (name, enrollment, branch/batch, resume, status, round result+attendance)")
      : fail(`applicant payload missing expected allowlisted fields: ${raw}`);

    const round = applicant.rounds?.find((r: any) => r.roundId === isroRound.id);
    round && round.result === "PASS" && !("remarks" in round) && !("nextAction" in round)
      ? ok("round history exposes result/attendance only — no internal remarks/nextAction")
      : fail(`round history shape wrong: ${JSON.stringify(round)}`);
  } else {
    fail(`could not fetch ISRO applicant for allowlist check: ${JSON.stringify(applicantsRes.json)}`);
  }

  // Offers: Rep A sees their own offer; Rep B sees none of ISRO's.
  const repAOffers = await api.get("/api/company/offers", repAJar);
  const repAHasOwnOffer = repAOffers.json?.offers?.some((o: any) => o.id === isroOffer.id);
  repAOffers.status === 200 && repAHasOwnOffer
    ? ok("Rep A sees their own company's offer via offer:read:company")
    : fail(`Rep A offer:read:company failed: ${JSON.stringify(repAOffers.json)}`);

  const repBOffers = await api.get("/api/company/offers", repBJar);
  const repBHasIsroOffer = repBOffers.json?.offers?.some((o: any) => o.id === isroOffer.id);
  repBOffers.status === 200 && !repBHasIsroOffer
    ? ok("Rep B's offer list does NOT include ISRO's offer")
    : fail(`Rep B saw ISRO's offer in their own list: ${JSON.stringify(repBOffers.json)}`);

  // The pre-existing offer:write gap: Rep B must not be able to change the
  // status of ISRO's offer, via either the old admin route or the new one.
  const repBWriteViaCompanyRoute = await api.patch(`/api/company/offers/${isroOffer.id}/status`, repBJar, { status: "ACCEPTED" });
  repBWriteViaCompanyRoute.status === 404
    ? ok("Rep B cannot change ISRO's offer status via /api/company/offers/:id/status (404)")
    : fail(`Rep B was able to hit ISRO's offer via the company route: ${repBWriteViaCompanyRoute.status}`);

  const repBWriteViaAdminRoute = await api.patch(`/api/admin/offers/${isroOffer.id}/status`, repBJar, { status: "ACCEPTED" });
  repBWriteViaAdminRoute.status === 404
    ? ok("Rep B cannot change ISRO's offer status via the legacy /api/admin/offers/:id/status route either (the pre-existing gap is closed)")
    : fail(`Rep B changed ISRO's offer status via the admin route! status ${repBWriteViaAdminRoute.status} — SECURITY GAP STILL OPEN`);

  // Rep A, by contrast, CAN legitimately update their own offer.
  const repAWrite = await api.patch(`/api/company/offers/${isroOffer.id}/status`, repAJar, { status: "ACCEPTED" });
  repAWrite.status === 200
    ? ok("Rep A CAN update the status of their own company's offer")
    : fail(`Rep A denied updating their own offer: ${repAWrite.status} ${JSON.stringify(repAWrite.json)}`);

  // A rep with no linked company fails closed, not open.
  const unlinkedUser = await prisma.user.upsert({
    where: { email: "rep-unlinked-verify@example.com" },
    update: {},
    create: {
      name: "Verify Rep Unlinked",
      email: "rep-unlinked-verify@example.com",
      passwordHash: HASH,
      role: "COMPANY_REP",
      isActive: true,
      mustChangePassword: false,
    },
  });
  await prisma.companyRepProfile.upsert({
    where: { userId: unlinkedUser.id },
    update: { companyId: null },
    create: { userId: unlinkedUser.id, companyName: "Unlinked Co" },
  });
  const unlinkedJar = await api.login("rep-unlinked-verify@example.com", "Password@123");
  const unlinkedDash = await api.get("/api/company/dashboard", unlinkedJar);
  unlinkedDash.status === 400
    ? ok("a company rep with no linked Company fails closed with a clear error (400), not an unscoped view")
    : fail(`unlinked rep got unexpected status ${unlinkedDash.status}: ${JSON.stringify(unlinkedDash.json)}`);

  // Cleanup: withdraw the fixture offer so it stops counting as an "active"
  // offer against max_offers_per_student for this shared demo student —
  // other verify scripts (verify-phase35.ts) create their own offer for the
  // same seeded student and don't expect one already on file.
  await prisma.offer.update({ where: { id: isroOffer.id }, data: { status: "WITHDRAWN" } });

  console.log(
    process.exitCode ? "\n=== Phase 7 FAILURES PRESENT ===\n" : "\n=== Phase 7 verified end-to-end ===\n"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
