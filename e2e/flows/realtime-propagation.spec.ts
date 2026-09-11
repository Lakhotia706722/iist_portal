import { test, expect, type Browser, type Page } from "@playwright/test";
import { login, ACCOUNTS, studentDisplayName } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 15 Step 5 — real cross-role propagation, two real browser sessions
 * open at once, no manual reload. Each test opens two independent browser
 * contexts (not just two logins in one context — a genuinely separate
 * cookie jar/session per role, the way two different people would each
 * have the app open), performs a real action as one role, and asserts the
 * *already-open* page for the other role updates on its own.
 */

async function newSession(browser: Browser, loginId: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, loginId);
  return { page, close: () => context.close() };
}

// Student A is a shared e2e fixture — its firstName/lastName can genuinely
// change (someone exploring the real Personal & Academic edit page this
// phase built, for instance), so every test below looks this up fresh via
// the shared studentDisplayName() helper instead of hardcoding
// "E2E Student A" as a literal string.
async function studentADisplayName(): Promise<string> {
  return studentDisplayName(prisma, ACCOUNTS.studentA.id);
}

const RUN = Date.now();

test("1 — Admin publishes a drive; Student's already-open Opportunities page shows it without reload", async ({ browser }) => {
  test.setTimeout(90_000);
  const DRIVE_TITLE = `RT Drive ${RUN}`;
  // "AAA "-prefixed so it sorts to the very top of the company picker —
  // this dev database has accumulated dozens of companies across every
  // phase/spec's own fixtures by now, and the picker's dropdown is a
  // fixed-height scrollable Radix Select (not a searchable combobox), so
  // an alphabetically-late name can end up scrolled out of view in a way
  // Playwright's auto-scroll doesn't reliably reach.
  const COMPANY_NAME = `AAA RT Drive Co ${RUN}`;
  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });
  await prisma.company.create({ data: { name: COMPANY_NAME, slug: `rt-drive-co-${RUN}`, industry: "TECHNOLOGY", isActive: true } });

  const student = await newSession(browser, ACCOUNTS.studentA.id);
  const admin = await newSession(browser, ACCOUNTS.admin.id);
  try {
    // Student's Opportunities page, open and searching for a drive that
    // doesn't exist yet — confirmed empty before the admin acts.
    await student.page.goto("/student/opportunities");
    await student.page.getByPlaceholder(/search opportunities/i).fill(DRIVE_TITLE);
    await expect(student.page.getByText(DRIVE_TITLE)).toHaveCount(0);

    // Admin creates + publishes the drive through the real UI, on a
    // completely separate session.
    await admin.page.goto("/admin/drives");
    await admin.page.getByRole("button", { name: /create drive/i }).first().click();
    await admin.page.getByRole("combobox").filter({ hasText: /select company/i }).click();
    await admin.page.getByRole("option", { name: COMPANY_NAME }).click();
    await admin.page.getByLabel(/drive title/i).fill(DRIVE_TITLE);
    await admin.page.getByRole("dialog").getByRole("button", { name: /^create drive$/i }).click();
    await admin.page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
    await expect(admin.page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });

    const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });
    // A future close date so it satisfies listActiveOpportunities() —
    // faster than driving the date picker through the UI, and the point
    // of this test is the live-propagation, not the create-drive form.
    await prisma.placementDrive.update({
      where: { id: drive.id },
      data: { applicationCloseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    const driveRow = admin.page.locator(".cursor-pointer", { hasText: DRIVE_TITLE });
    await driveRow.getByRole("button").last().click();
    await admin.page.getByRole("menuitem", { name: /change to published/i }).click();
    await expect(admin.page.getByText(/^published$/i).first()).toBeVisible({ timeout: 15_000 });
    await driveRow.getByRole("button").last().click();
    await admin.page.getByRole("menuitem", { name: /applications open/i }).click();

    // Student's page was already open and never reloaded — the search
    // filter is still active, so this can only appear via the page's own
    // refetchInterval poll (15s) picking up the new APPLICATIONS_OPEN drive.
    await expect(student.page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 25_000 });
  } finally {
    await prisma.placementDrive.deleteMany({ where: { title: DRIVE_TITLE } }).catch(() => {});
    await prisma.company.deleteMany({ where: { name: COMPANY_NAME } }).catch(() => {});
    await student.close();
    await admin.close();
  }
});

test("2 — Student edits their profile; Admin's already-open Students directory reflects it without reload", async ({ browser }) => {
  test.setTimeout(90_000);
  const NEW_LAST_NAME = `Verified${RUN}`;
  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const originalLastName = student.lastName;
  // This is a shared e2e fixture whose firstName can genuinely differ from
  // "E2E" (see studentADisplayName's comment) — build both before/after
  // names from whatever the current firstName actually is, not a literal.
  const beforeName = [student.firstName, originalLastName].filter(Boolean).join(" ");
  const afterName = [student.firstName, NEW_LAST_NAME].filter(Boolean).join(" ");

  const admin = await newSession(browser, ACCOUNTS.admin.id);
  const studentSession = await newSession(browser, ACCOUNTS.studentA.id);
  try {
    // Admin's Students directory, open and already showing the student's
    // current (old) name.
    await admin.page.goto("/admin/students");
    await admin.page.getByPlaceholder(/search by name or enrollment/i).fill(ACCOUNTS.studentA.id);
    await expect(admin.page.getByText(beforeName, { exact: false })).toBeVisible({ timeout: 15_000 });

    // Student edits their own name through the real Personal & Academic form.
    await studentSession.page.goto("/student/profile");
    await expect(studentSession.page.getByRole("button", { name: "Personal Info" })).toBeVisible({ timeout: 15_000 });
    await studentSession.page.locator("#lastName").fill(NEW_LAST_NAME);
    await studentSession.page.getByRole("button", { name: /save changes/i }).click();
    await expect(studentSession.page.getByText(/updated/i)).toBeVisible({ timeout: 15_000 });

    // Admin's page, still open, never reloaded, still filtered to the same
    // search term — must pick up the new name on its own.
    await expect(admin.page.getByText(afterName, { exact: false })).toBeVisible({ timeout: 25_000 });
  } finally {
    await prisma.student.update({ where: { id: student.id }, data: { lastName: originalLastName } });
    await admin.close();
    await studentSession.close();
  }
});

test("3 (fast path) — Admin shortlists an application; Student's already-open tracking view updates well inside the base poll interval", async ({ browser }) => {
  test.setTimeout(90_000);
  const DRIVE_TITLE = `RT Shortlist Drive ${RUN}`;
  const ROLE_TITLE = "RT Fast-Path Role";
  const studentName = await studentADisplayName();

  // Fresh drive/role/application at APPLIED — the apply-flow UI itself is
  // already covered elsewhere (apply-flow.spec.ts); this test's subject is
  // the shortlist -> student-view propagation, not applying.
  const studentRow = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const company = await prisma.company.findFirstOrThrow({ where: { isActive: true } });
  const admin0 = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS.admin.email } });
  await prisma.application.deleteMany({ where: { studentId: studentRow.id, jobRole: { title: ROLE_TITLE } } });
  await prisma.jobRole.deleteMany({ where: { title: ROLE_TITLE, drive: { title: DRIVE_TITLE } } });
  await prisma.placementDrive.deleteMany({ where: { title: DRIVE_TITLE } });
  const drive = await prisma.placementDrive.create({
    data: { companyId: company.id, title: DRIVE_TITLE, academicYear: "2025-2026", status: "APPLICATIONS_CLOSED", createdById: admin0.id },
  });
  const jobRole = await prisma.jobRole.create({ data: { driveId: drive.id, title: ROLE_TITLE, ctcMin: 8, ctcMax: 10 } });
  const resume = await prisma.resume.findFirstOrThrow({ where: { studentId: studentRow.id } });
  const resumeVersion = await prisma.resumeVersion.findFirst({ where: { resumeId: resume.id } })
    ?? await prisma.resumeVersion.create({ data: { resumeId: resume.id, version: 1, isGenerated: true } });
  const application = await prisma.application.create({
    data: { studentId: studentRow.id, driveId: drive.id, jobRoleId: jobRole.id, status: "APPLIED", resumeVersionId: resumeVersion.id },
  });

  const student = await newSession(browser, ACCOUNTS.studentA.id);
  const admin = await newSession(browser, ACCOUNTS.admin.id);
  try {
    // Open the student's tracking view FIRST, and record the moment it
    // mounts — its own refetchInterval (15s) doesn't fire again until
    // roughly openedAt + 15s, so any update visible clearly before that
    // deadline cannot be explained by this query's own poll cycle at all;
    // it has to be the notification-triggered fast path (the notification
    // bell's own 8s poll, invalidating this query the moment a
    // "shortlisted" notification shows up).
    await student.page.goto("/student/applications");
    await expect(student.page.getByText(ROLE_TITLE)).toBeVisible({ timeout: 15_000 });
    const openedAt = Date.now();

    await admin.page.goto(`/admin/drives/${drive.id}`);
    await admin.page.getByRole("tab", { name: /shortlisting/i }).click();
    await expect(admin.page.getByText(studentName)).toBeVisible({ timeout: 15_000 });
    await admin.page.locator("tr", { hasText: studentName }).getByRole("button").first().click();
    await admin.page.getByRole("combobox").filter({ hasText: /choose action/i }).click();
    await admin.page.getByRole("option", { name: /^shortlist$/i }).click();
    await admin.page.getByRole("button", { name: /^apply$/i }).click();
    await expect(admin.page.getByText(studentName)).toHaveCount(0, { timeout: 15_000 });

    await expect(student.page.locator("text=Shortlisted").first()).toBeVisible({ timeout: 20_000 });
    const elapsedMs = Date.now() - openedAt;

    // The applications-list query's OWN poll wouldn't fire until ~15s
    // after openedAt — an update landing meaningfully before that deadline
    // is evidence the fast path (not the base poll) delivered it.
    expect(elapsedMs, `update took ${elapsedMs}ms — expected well under the 15s base poll interval, proving the notification fast path fired`).toBeLessThan(14_000);
  } finally {
    await prisma.application.deleteMany({ where: { id: application.id } });
    await student.close();
    await admin.close();
  }
});

test("4a — Admin marks attendance; Student's already-open Journey Tracker updates without reload", async ({ browser }) => {
  test.setTimeout(90_000);
  const DRIVE_TITLE = `RT Attendance Drive ${RUN}`;
  const ROLE_TITLE = "RT Attendance Role";
  const ROUND_TITLE = `RT Round ${RUN}`;
  const studentName = await studentADisplayName();

  const studentRow = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const company = await prisma.company.findFirstOrThrow({ where: { isActive: true } });
  const admin0 = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS.admin.email } });
  await prisma.placementDrive.deleteMany({ where: { title: DRIVE_TITLE } });
  const drive = await prisma.placementDrive.create({
    data: { companyId: company.id, title: DRIVE_TITLE, academicYear: "2025-2026", status: "APPLICATIONS_CLOSED", createdById: admin0.id },
  });
  const jobRole = await prisma.jobRole.create({ data: { driveId: drive.id, title: ROLE_TITLE, ctcMin: 8, ctcMax: 10 } });
  const resume = await prisma.resume.findFirstOrThrow({ where: { studentId: studentRow.id } });
  const resumeVersion = await prisma.resumeVersion.findFirst({ where: { resumeId: resume.id } })
    ?? await prisma.resumeVersion.create({ data: { resumeId: resume.id, version: 1, isGenerated: true } });
  const application = await prisma.application.create({
    data: { studentId: studentRow.id, driveId: drive.id, jobRoleId: jobRole.id, status: "SHORTLISTED", resumeVersionId: resumeVersion.id },
  });

  const student = await newSession(browser, ACCOUNTS.studentA.id);
  const admin = await newSession(browser, ACCOUNTS.admin.id);
  try {
    // Student's Journey Tracker, open while the application exists but
    // genuinely has no round yet — expand it to confirm the round step is
    // really absent, not just collapsed.
    await student.page.goto("/student/journey");
    await expect(student.page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });
    await student.page.getByText(DRIVE_TITLE).click();
    await expect(student.page.getByText(ROUND_TITLE)).toHaveCount(0);

    // Admin creates the round, adds the student as a participant, and
    // marks attendance — all on a separate session, all without the
    // student ever reloading.
    await admin.page.goto(`/admin/drives/${drive.id}`);
    await admin.page.getByRole("tab", { name: /^rounds$/i }).click();
    await admin.page.getByRole("button", { name: /add round/i }).first().click();
    await admin.page.getByPlaceholder(/technical interview/i).fill(ROUND_TITLE);
    await admin.page.getByRole("button", { name: /^save round$/i }).click();
    await expect(admin.page.getByText(ROUND_TITLE)).toBeVisible({ timeout: 15_000 });
    await admin.page.getByText(ROUND_TITLE).click();
    await admin.page.getByRole("button", { name: /add participants/i }).click();
    await expect(admin.page.getByRole("dialog").getByText(studentName)).toBeVisible({ timeout: 15_000 });
    await admin.page.getByRole("dialog").getByText(studentName).click();
    await admin.page.getByRole("dialog").getByRole("button", { name: /^add \d+ participants?$/i }).click();
    await expect(admin.page.getByText(/participant\(s\) added/i)).toBeVisible({ timeout: 15_000 });
    await admin.page.getByRole("tab", { name: /attendance/i }).click();
    await expect(admin.page.getByText(studentName)).toBeVisible({ timeout: 15_000 });
    await admin.page.locator("tr", { hasText: studentName }).getByRole("button", { name: /^pre$/i }).click();

    // No reload on the student side — the round now embedded in their
    // applications-journey query (15s refetchInterval) must appear on its
    // own, in the same already-expanded card.
    await expect(student.page.getByText(ROUND_TITLE)).toBeVisible({ timeout: 25_000 });
  } finally {
    await prisma.roundParticipant.deleteMany({ where: { application: { id: application.id } } });
    await prisma.placementRound.deleteMany({ where: { driveId: drive.id } });
    await prisma.application.deleteMany({ where: { id: application.id } });
    await student.close();
    await admin.close();
  }
});

test("4b — Admin records an offer; Student's already-open Placement History shows it without reload", async ({ browser }) => {
  test.setTimeout(90_000);
  const DRIVE_TITLE = `RT Offer Drive ${RUN}`;
  const ROLE_TITLE = "RT Offer Role";
  const COMPANY_NAME = `RT Offer Co ${RUN}`;
  const studentName = await studentADisplayName();

  const studentRow = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const admin0 = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS.admin.email } });
  // The offer policy caps this student at 1 active offer — a dangling
  // offer left by any earlier interrupted test run (this file's own prior
  // attempts, or another spec's) would otherwise block a fresh Record
  // Offer submission with a real, correct policy-limit validation error,
  // not an app bug. Fixture data, so clearing every existing offer for
  // this student first is safe.
  await prisma.offer.deleteMany({ where: { studentId: studentRow.id } });
  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });
  const company = await prisma.company.create({
    data: { name: COMPANY_NAME, slug: `rt-offer-co-${RUN}`, industry: "TECHNOLOGY", isActive: true },
  });
  const drive = await prisma.placementDrive.create({
    data: { companyId: company.id, title: DRIVE_TITLE, academicYear: "2025-2026", status: "APPLICATIONS_CLOSED", createdById: admin0.id },
  });
  const jobRole = await prisma.jobRole.create({ data: { driveId: drive.id, title: ROLE_TITLE, ctcMin: 8, ctcMax: 10 } });
  const resume = await prisma.resume.findFirstOrThrow({ where: { studentId: studentRow.id } });
  const resumeVersion = await prisma.resumeVersion.findFirst({ where: { resumeId: resume.id } })
    ?? await prisma.resumeVersion.create({ data: { resumeId: resume.id, version: 1, isGenerated: true } });
  const application = await prisma.application.create({
    data: { studentId: studentRow.id, driveId: drive.id, jobRoleId: jobRole.id, status: "SELECTED", resumeVersionId: resumeVersion.id },
  });

  const student = await newSession(browser, ACCOUNTS.studentA.id);
  const admin = await newSession(browser, ACCOUNTS.admin.id);
  try {
    // Student's Placement History, open before any offer exists.
    await student.page.goto("/student/placement-history");
    await expect(student.page.getByText(COMPANY_NAME)).toHaveCount(0);

    await admin.page.goto("/admin/offers");
    await admin.page.getByRole("button", { name: /record offer/i }).first().click();
    await expect(admin.page.getByText(/record an offer/i)).toBeVisible({ timeout: 10_000 });
    await admin.page.getByLabel(/selected application/i).selectOption({ label: `${studentName} — ${COMPANY_NAME} · ${ROLE_TITLE}` });
    await admin.page.getByLabel("CTC (LPA)").fill("12");
    await admin.page.getByRole("dialog").getByRole("button", { name: /^(record offer|save|submit)$/i }).last().click();
    await expect(admin.page.getByText(/offer recorded/i)).toBeVisible({ timeout: 15_000 });

    // No reload on the student side.
    await expect(student.page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 25_000 });
  } finally {
    await prisma.offer.deleteMany({ where: { applicationId: application.id } });
    await prisma.application.deleteMany({ where: { id: application.id } });
    await prisma.jobRole.deleteMany({ where: { id: jobRole.id } });
    await prisma.placementDrive.deleteMany({ where: { id: drive.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
    await student.close();
    await admin.close();
  }
});

test("5 — Faculty publishes a SkillUp result; Student's already-open SkillUp dashboard shows it without reload", async ({ browser }) => {
  test.setTimeout(60_000);
  const TEST_TITLE = `RT SkillUp Test ${RUN}`;

  const studentRow = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  await prisma.testResult.deleteMany({ where: { test: { title: TEST_TITLE } } });
  await prisma.testParticipant.deleteMany({ where: { test: { title: TEST_TITLE } } });
  await prisma.test.deleteMany({ where: { title: TEST_TITLE } });

  const student = await newSession(browser, ACCOUNTS.studentA.id);
  const faculty = await newSession(browser, ACCOUNTS.faculty.id);
  try {
    // Student's SkillUp dashboard, open before this result exists.
    await student.page.goto("/student/skillup");
    await expect(student.page.getByText(TEST_TITLE)).toHaveCount(0);

    await faculty.page.goto("/faculty/skillup");
    await faculty.page.getByRole("button", { name: /create test/i }).first().click();
    await faculty.page.locator("#test-title").fill(TEST_TITLE);
    const scheduledAt = new Date(Date.now() - 3_600_000).toISOString().slice(0, 16);
    await faculty.page.locator("#test-when").fill(scheduledAt);
    await faculty.page.locator("#test-max").fill("100");
    await faculty.page.locator("#test-pass").fill("40");
    await faculty.page.locator("#test-batch").selectOption(studentRow.batchId);
    await faculty.page.getByRole("dialog").getByRole("button", { name: /^create test$/i }).click();
    await expect(faculty.page.getByText(TEST_TITLE)).toBeVisible({ timeout: 15_000 });

    const row = faculty.page.locator("tr", { hasText: TEST_TITLE });
    await row.getByRole("button", { name: /results/i }).click();
    await expect(faculty.page.getByRole("dialog").getByText(`Results — ${TEST_TITLE}`)).toBeVisible({ timeout: 15_000 });

    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const csvPath = path.join(os.tmpdir(), `rt-skillup-${RUN}.csv`);
    fs.writeFileSync(csvPath, `${ACCOUNTS.studentA.id},91,realtime propagation check`);
    await faculty.page.locator('input[type="file"]').setInputFiles(csvPath);
    await expect(faculty.page.getByText(/1 row\(s\) parsed/i)).toBeVisible({ timeout: 5_000 });
    await faculty.page.getByRole("button", { name: /^publish 1 result/i }).click();
    await expect(faculty.page.getByText(/results published/i)).toBeVisible({ timeout: 15_000 });
    fs.unlinkSync(csvPath);

    // No reload on the student side. Scope the score check to this
    // specific test's own row — "91" alone is ambiguous against the
    // pre-existing e2e fixture's own "best 91%" aggregate stat.
    await expect(student.page.getByText(TEST_TITLE)).toBeVisible({ timeout: 25_000 });
    const testLink = student.page.getByRole("link", { name: TEST_TITLE });
    await expect(testLink.getByText("91", { exact: false }).first()).toBeVisible();
  } finally {
    await prisma.testResult.deleteMany({ where: { test: { title: TEST_TITLE } } });
    await prisma.testParticipant.deleteMany({ where: { test: { title: TEST_TITLE } } });
    await prisma.test.deleteMany({ where: { title: TEST_TITLE } });
    await student.close();
    await faculty.close();
  }
});
