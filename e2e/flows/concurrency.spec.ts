import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 11 — P2. Two-actor, same-resource concurrency. Each test fires
 * genuinely simultaneous requests (Promise.all of real, authenticated
 * page.request calls — not sequential double-clicks) against the same
 * DB row and asserts the app never crashes and never lands in a torn/
 * inconsistent state, only ever in one of the two requested end states.
 *
 * Note on scope: "two students applying to the last available slot" from
 * the brief doesn't apply here — job roles' `openings` field is purely
 * informational (confirmed by reading drive.service.ts/application.service.ts;
 * no capacity check exists anywhere in applyForJobRole), so there is no
 * slot-limited race to exercise. Application-level concurrency (two
 * concurrent applies for the same student+role) is covered instead by
 * double-submission.spec.ts's second test, which is the same class of
 * race.
 */

test("Two concurrent shortlist/reject actions on the same applicant: consistent final state, no crash", async ({ page }) => {
  test.setTimeout(60_000);

  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const jobRole = await prisma.jobRole.findFirstOrThrow({ where: { title: "E2E Software Engineer" } });
  await prisma.applicationStatusHistory.deleteMany({ where: { application: { studentId: student.id, jobRoleId: jobRole.id } } });
  await prisma.application.deleteMany({ where: { studentId: student.id, jobRoleId: jobRole.id } });
  const application = await prisma.application.create({ data: { studentId: student.id, driveId: (await prisma.jobRole.findUniqueOrThrow({ where: { id: jobRole.id } })).driveId, jobRoleId: jobRole.id, status: "APPLIED" } });

  await login(page, ACCOUNTS.admin.id);

  const shortlistBody = { applicationIds: [application.id], action: "SHORTLISTED" };
  const rejectBody = { applicationIds: [application.id], action: "REJECTED" };
  const [r1, r2] = await Promise.all([
    page.request.post(`/api/admin/drives/${application.driveId}/shortlist`, { data: shortlistBody }),
    page.request.post(`/api/admin/drives/${application.driveId}/shortlist`, { data: rejectBody }),
  ]);

  // Neither request should ever 500 regardless of which "wins" the race.
  expect(r1.status(), "shortlist request crashed").toBeLessThan(500);
  expect(r2.status(), "reject request crashed").toBeLessThan(500);

  const final = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
  expect(["SHORTLISTED", "REJECTED"]).toContain(final.status);

  // Both attempts are individually audited (last-write-wins on the
  // Application row itself — no optimistic locking/version column exists
  // to make this a true compare-and-swap — but every attempt leaves a
  // real trace, so a losing admin's action is reconcilable after the
  // fact rather than silently vanishing without record).
  const history = await prisma.applicationStatusHistory.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "asc" } });
  expect(history.length, "expected one history row per concurrent attempt").toBe(2);
  expect(history[history.length - 1].toStatus).toBe(final.status);
});

test("Concurrent attendance marking on the same participant: no lost update, no crash", async ({ page }) => {
  test.setTimeout(60_000);

  const round = await prisma.placementRound.findFirstOrThrow({ where: { title: "E2E Technical Round" } });
  const participant = await prisma.roundParticipant.findFirstOrThrow({ where: { roundId: round.id } });
  await prisma.attendanceRecord.deleteMany({ where: { roundParticipantId: participant.id } });

  await login(page, ACCOUNTS.admin.id);

  const [r1, r2] = await Promise.all([
    page.request.post(`/api/admin/rounds/${round.id}/attendance`, { data: { roundParticipantId: participant.id, status: "PRESENT" } }),
    page.request.post(`/api/admin/rounds/${round.id}/attendance`, { data: { roundParticipantId: participant.id, status: "ABSENT" } }),
  ]);

  expect(r1.status(), "first attendance request crashed").toBeLessThan(500);
  expect(r2.status(), "second attendance request crashed").toBeLessThan(500);

  // Exactly one AttendanceRecord (the DB's own @unique on
  // roundParticipantId is the real safety net here — this confirms it
  // actually holds under true concurrency, not just sequential calls).
  const records = await prisma.attendanceRecord.findMany({ where: { roundParticipantId: participant.id } });
  expect(records, "concurrent marking produced more than one AttendanceRecord for the same participant").toHaveLength(1);
  expect(["PRESENT", "ABSENT"]).toContain(records[0].status);
});

test("Policy edit racing a student's eligibility check: the check never reads a torn/partial value", async ({ page }) => {
  test.setTimeout(60_000);

  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: "AE" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { branchId: branch.id, academicYear: "2021-2025" } });
  // Baseline: no override for this batch.
  await prisma.policyRule.deleteMany({ where: { key: "skillup_required", batchId: batch.id } });

  await login(page, ACCOUNTS.admin.id);

  // Fire a policy PUT and a compliance-status GET at the same instant,
  // repeated a few times — the read must always come back as a
  // complete, valid boolean-backed status, never a crash or a value that
  // isn't one of the two policy states this could plausibly race between.
  const studentB = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentB.id } });
  let sawEligible = false;
  let sawConditional = false;
  for (let i = 0; i < 6; i++) {
    const enable = i % 2 === 0;
    const [writeRes, readRes] = await Promise.all([
      page.request.put(`/api/admin/policy/skillup_required`, { data: { value: String(enable), batchId: batch.id } }),
      page.request.get(`/api/admin/compliance/${studentB.id}`),
    ]);
    expect(writeRes.status(), "policy update crashed").toBeLessThan(500);
    expect(readRes.status(), "compliance read crashed while a policy write was in flight").toBeLessThan(500);
    const body = await readRes.json();
    expect(["ELIGIBLE", "CONDITIONAL", "RESTRICTED", "PLACED", "DEBARRED"]).toContain(body.status);
    if (body.status === "ELIGIBLE") sawEligible = true;
    if (body.status === "CONDITIONAL") sawConditional = true;
  }
  // Not asserting which one wins each race — only that every single read
  // was a real, complete, valid status the rest of the app understands.
  expect(sawEligible || sawConditional, "never observed a plausible status across 6 racing reads — check the test setup").toBe(true);

  await prisma.policyRule.deleteMany({ where: { key: "skillup_required", batchId: batch.id } });
});
