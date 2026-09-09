/**
 * Phase 3.5 verification harness.
 *
 * Exercises the P0 fixes against the real database:
 *   1. Eligibility resolves via Student.id (the bug was passing User.id)
 *   2. Offer lifecycle: create -> ACCEPTED -> JOINED, with audit rows
 *
 * Run: npx tsx scripts/verify-phase35.ts
 */

import { prisma } from "../lib/prisma";
import { evaluateEligibility } from "../lib/eligibility-engine";
import {
  createOffer,
  updateOfferStatus,
  listOffersForStudent,
  listOfferableApplications,
  getOfferStats,
} from "../server/services/offer.service";
import { getStudentIdFromUserId } from "../lib/auth/student-session";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  process.exitCode = 1;
};

async function main() {
  console.log("\n=== Phase 3.5 verification ===\n");

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "student@iist.ac.in" },
    include: { student: true },
  });
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "tpadmin@iist.ac.in" },
  });
  const student = user.student!;

  // ── 1. Fixture: company / drive / role / eligibility rule ──────────────────
  console.log("[1] Seeding Phase 3 fixture");
  const company = await prisma.company.upsert({
    where: { slug: "verify-corp" },
    update: {},
    create: {
      name: "Verify Corp",
      slug: "verify-corp",
      industry: "TECHNOLOGY",
      isActive: true,
    },
  });

  let drive = await prisma.placementDrive.findFirst({
    where: { companyId: company.id, title: "Verification Drive" },
  });
  drive ??= await prisma.placementDrive.create({
    data: {
      companyId: company.id,
      title: "Verification Drive",
      academicYear: "2024-2025",
      status: "APPLICATIONS_OPEN",
      createdById: admin.id,
      applicationCloseAt: new Date(Date.now() + 7 * 864e5),
    },
  });

  let role = await prisma.jobRole.findFirst({
    where: { driveId: drive.id, title: "Verification SDE" },
  });
  role ??= await prisma.jobRole.create({
    data: { driveId: drive.id, title: "Verification SDE", ctcMin: 12, ctcMax: 18 },
  });

  const existingRule = await prisma.eligibilityRule.findFirst({
    where: { jobRoleId: role.id, field: "CGPA" },
  });
  if (!existingRule) {
    await prisma.eligibilityRule.create({
      data: {
        jobRoleId: role.id,
        field: "CGPA",
        operator: "GTE",
        value: "6.0",
        label: "Min CGPA 6.0",
      },
    });
  }
  ok(`fixture ready (drive ${drive.id}, role ${role.id})`);

  // ── 2. The eligibility bug ────────────────────────────────────────────────
  console.log("\n[2] Eligibility: Student.id vs User.id");

  const resolved = await getStudentIdFromUserId(user.id);
  resolved === student.id
    ? ok("getStudentIdFromUserId resolves User.id -> Student.id")
    : fail(`resolved ${resolved}, expected ${student.id}`);

  const good = await evaluateEligibility(student.id, role.id);
  ok(
    `evaluateEligibility(Student.id) -> eligible=${good.eligible}, rules evaluated=${good.results.length}`
  );
  if (good.results.length === 0) fail("expected at least one rule to be evaluated");

  // The old (buggy) call shape must be the thing that throws.
  let threwOnUserId = false;
  try {
    await evaluateEligibility(user.id, role.id);
  } catch {
    threwOnUserId = true;
  }
  threwOnUserId
    ? ok("evaluateEligibility(User.id) still throws — confirms the original bug shape")
    : fail("passing User.id did not throw; test is not proving the fix");

  // ── 3. Offer lifecycle ────────────────────────────────────────────────────
  console.log("\n[3] Offer lifecycle");

  const application = await prisma.application.upsert({
    where: { studentId_jobRoleId: { studentId: student.id, jobRoleId: role.id } },
    update: { status: "SELECTED" },
    create: {
      studentId: student.id,
      driveId: drive.id,
      jobRoleId: role.id,
      status: "SELECTED",
    },
  });
  await prisma.offer.deleteMany({ where: { applicationId: application.id } });

  const offerable = await listOfferableApplications();
  offerable.some((a) => a.id === application.id)
    ? ok("SELECTED application appears in offerable list")
    : fail("SELECTED application missing from offerable list");

  const auditBefore = await prisma.auditLog.count({ where: { entity: "Offer" } });

  const offer = await createOffer(
    {
      applicationId: application.id,
      category: "CORE",
      type: "FULL_TIME",
      isPPO: false,
      ctc: 18.5,
      stipend: null,
      ctcBreakdown: "Base 14L + Bonus 4.5L",
      location: "Bengaluru",
      offerDate: new Date(),
      joiningDate: new Date(Date.now() + 90 * 864e5),
    },
    admin.id
  );
  offer.status === "OFFERED"
    ? ok(`offer created (${offer.id}) status=OFFERED ctc=${offer.ctc}`)
    : fail(`unexpected initial status ${offer.status}`);

  // Duplicate guard
  let conflicted = false;
  try {
    await createOffer(
      {
        applicationId: application.id,
        category: "CORE",
        type: "FULL_TIME",
        isPPO: false,
        ctc: 10,
        stipend: null,
        ctcBreakdown: null,
        location: null,
        offerDate: new Date(),
        joiningDate: null,
      },
      admin.id
    );
  } catch (e) {
    conflicted = (e as Error).name === "ConflictError";
  }
  conflicted ? ok("duplicate offer rejected (ConflictError)") : fail("duplicate offer was allowed");

  // Illegal transition
  let rejectedJump = false;
  try {
    await updateOfferStatus(offer.id, "JOINED", admin.id);
  } catch (e) {
    rejectedJump = (e as Error).name === "ValidationError";
  }
  rejectedJump
    ? ok("illegal transition OFFERED -> JOINED rejected")
    : fail("illegal transition was allowed");

  const accepted = await updateOfferStatus(offer.id, "ACCEPTED", admin.id, "Student accepted");
  accepted.status === "ACCEPTED" && accepted.acceptedAt
    ? ok("OFFERED -> ACCEPTED (acceptedAt stamped)")
    : fail("ACCEPTED transition did not stamp acceptedAt");

  const joined = await updateOfferStatus(offer.id, "JOINED", admin.id);
  joined.status === "JOINED" && joined.joinedAt
    ? ok("ACCEPTED -> JOINED (joinedAt stamped)")
    : fail("JOINED transition did not stamp joinedAt");

  let terminal = false;
  try {
    await updateOfferStatus(offer.id, "WITHDRAWN", admin.id);
  } catch (e) {
    terminal = (e as Error).name === "ValidationError";
  }
  terminal ? ok("JOINED is terminal — further changes rejected") : fail("terminal state was mutable");

  // ── 4. Audit + student view ───────────────────────────────────────────────
  console.log("\n[4] Audit trail and student-facing history");

  const auditAfter = await prisma.auditLog.count({ where: { entity: "Offer" } });
  const written = auditAfter - auditBefore;
  written >= 3
    ? ok(`${written} AuditLog rows written for Offer (create + 2 status changes)`)
    : fail(`expected >= 3 audit rows, got ${written}`);

  const actions = await prisma.auditLog.findMany({
    where: { entity: "Offer", entityId: offer.id },
    select: { action: true },
  });
  console.log(`      actions: ${actions.map((a) => a.action).join(", ")}`);

  const history = await listOffersForStudent(student.id);
  history.some((o) => o.id === offer.id)
    ? ok(`student placement history returns ${history.length} offer(s)`)
    : fail("offer missing from student placement history");

  const stats = await getOfferStats();
  ok(`stats: total=${stats.total} avgCTC=${stats.ctc.average?.toFixed(2) ?? "-"}`);

  console.log(
    process.exitCode ? "\n=== FAILURES PRESENT ===\n" : "\n=== All checks passed ===\n"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
