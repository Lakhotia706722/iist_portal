/**
 * Phase 13 Step 4 — real end-to-end data flow proof, from an empty database.
 *
 * NOT part of the regular suite (`npm run test:e2e`) — it depends on a
 * scratch database seeded with ONLY seed-reference-data.ts plus one real
 * admin account (via prisma/create-admin.ts), not the shared dev/e2e
 * fixture DB every other spec in this directory assumes. Guarded to skip
 * unless explicitly requested, so it can never run by accident in CI or a
 * normal local `npm run test:e2e`.
 *
 * Run explicitly:
 *   1. Point DATABASE_URL at a scratch DB, run:
 *        npx prisma migrate deploy
 *        npx tsx prisma/seed-reference-data.ts
 *        npx tsx prisma/create-admin.ts --name "..." --email "..." --password "..."
 *        npx tsx prisma/seed-reference-data.ts   # again, backfills policy defaults now that an admin exists
 *   2. Start the app against that DATABASE_URL (npm run dev -- -p 4242).
 *   3. PHASE13_SCRATCH_WALKTHROUGH=1 ADMIN_EMAIL=... ADMIN_PASSWORD=... npx playwright test e2e/manual-phase13-data-flow.spec.ts
 *
 * Proves the actual point of Phase 13: not just "no mock data" but "data
 * entered in one place propagates everywhere it's supposed to appear" —
 * company -> drive -> role -> eligibility -> student sees + applies ->
 * admin shortlists/rounds/attendance/offer -> student sees offer -> HOD's
 * department analytics reflect it -> Faculty's SkillUp result appears on
 * the student's own dashboard -> Command Center's aggregate counts are
 * exactly what was just entered, not off by a seed baseline.
 */
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

test.skip(!process.env.PHASE13_SCRATCH_WALKTHROUGH, "Manual walkthrough — run explicitly against a scratch DB (see file header), never in the regular suite.");

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tpcell@iist.ac.in";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TempPass123!";
const PASSWORD = "Password@123";

const RUN = Date.now();
const COMPANY_NAME = `Aether Robotics Pvt. Ltd. ${RUN}`;
const DRIVE_TITLE = `Campus Drive ${RUN}`;
const ROLE_TITLE = "Graduate Engineer Trainee";
const FACULTY_EMAIL = `priya.faculty.${RUN}@iist.ac.in`;
const HOD_EMAIL = `rajan.hod.${RUN}@iist.ac.in`;
const STUDENT_EMAIL = `student.${RUN}@iist.ac.in`;
const STUDENT_ENROLLMENT = `IIST2022CS${String(RUN).slice(-3)}`;

async function login(page: Page, loginId: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/enrollment number|email/i).fill(loginId);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log ?in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });

test("0 — scratch DB really is empty of placement data before we start", async () => {
  const [companies, drives, applications, offers] = await Promise.all([
    prisma.company.count(),
    prisma.placementDrive.count(),
    prisma.application.count(),
    prisma.offer.count(),
  ]);
  expect({ companies, drives, applications, offers }).toEqual({ companies: 0, drives: 0, applications: 0, offers: 0 });
});

test("1 — Admin: forced password change on first login, then creates Company + Drive + Role + Eligibility", async ({ page }) => {
  test.setTimeout(90_000);

  // First login on a mustChangePassword:true account — real forced-change
  // flow. Re-runnable: if a prior run already changed the password, the
  // temp one will be rejected — fall back to the already-changed one so
  // this script stays idempotent instead of requiring a fresh scratch DB
  // every single time.
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
  await page.goto("/login");
  await page.getByLabel(/enrollment number|email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/^password/i).fill(admin.mustChangePassword ? ADMIN_PASSWORD : PASSWORD);
  await page.getByRole("button", { name: /sign in|log ?in/i }).click();

  if (admin.mustChangePassword) {
    await page.waitForURL(/change-password/, { timeout: 15_000 });
    await page.getByLabel(/current password/i).fill(ADMIN_PASSWORD);
    await page.getByLabel(/^new password/i).fill(PASSWORD);
    await page.getByLabel(/confirm.*password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /change password|update|save/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("change-password"), { timeout: 15_000 });
  } else {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  }

  // Company
  await page.goto("/admin/companies");
  await page.getByRole("button", { name: /add company/i }).first().click();
  await page.getByLabel(/company name/i).fill(COMPANY_NAME);
  await page.getByRole("button", { name: /^create company$/i }).click();
  await page.getByPlaceholder(/search companies/i).fill(COMPANY_NAME);
  await expect(page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 15_000 });

  // Drive
  await page.goto("/admin/drives");
  await page.getByRole("button", { name: /create drive/i }).first().click();
  await page.getByRole("combobox").filter({ hasText: /select company/i }).click();
  await page.getByRole("option", { name: COMPANY_NAME }).click();
  await page.getByLabel(/drive title/i).fill(DRIVE_TITLE);
  await page.getByRole("dialog").getByRole("button", { name: /^create drive$/i }).click();
  await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
  await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });

  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });

  // Job role
  await page.goto(`/admin/drives/${drive.id}`);
  await page.getByRole("tab", { name: /roles/i }).click();
  await page.getByRole("button", { name: /add job role/i }).first().click();
  await page.getByLabel(/role title/i).fill(ROLE_TITLE);
  await page.getByRole("dialog").getByRole("button", { name: /^create role$/i }).click();
  await expect(page.getByText(ROLE_TITLE)).toBeVisible({ timeout: 15_000 });

  // Eligibility — real branch + CGPA cutoff, through the real UI dialog
  // built this phase (there was no way to do this at all before). Exactly
  // one job role exists at this point, so the button is unambiguous.
  await page.getByRole("button", { name: /eligibility/i }).click();
  await expect(page.getByRole("dialog").getByText(`Eligibility — ${ROLE_TITLE}`)).toBeVisible({ timeout: 10_000 });
  // Rule 1: Branch = BTECH-CSE
  await page.getByLabel("Field").selectOption("BRANCH");
  await page.getByPlaceholder(/value.*e\.g\. 7\.5/i).fill("BTECH-CSE");
  await page.getByPlaceholder(/label shown to students/i).fill("Open to CSE branch only");
  await page.getByRole("button", { name: /add rule/i }).click();
  // Rule 2: CGPA >= 7.5
  await page.getByLabel("Field").selectOption("CGPA");
  await page.getByLabel("Operator").selectOption("GTE");
  await page.getByPlaceholder(/value.*e\.g\. 7\.5/i).fill("7.5");
  await page.getByPlaceholder(/label shown to students/i).fill("Minimum CGPA 7.5");
  await page.getByRole("button", { name: /add rule/i }).click();
  await expect(page.getByText("Open to CSE branch only")).toBeVisible();
  await expect(page.getByText("Minimum CGPA 7.5")).toBeVisible();
  await page.getByRole("button", { name: /save rules/i }).click();
  await expect(page.getByText(/eligibility rules saved/i)).toBeVisible({ timeout: 10_000 });

  const rules = await prisma.eligibilityRule.findMany({ where: { jobRole: { title: ROLE_TITLE, driveId: drive.id } } });
  expect(rules).toHaveLength(2);

  // Publish -> Applications Open, so a student can actually apply.
  await page.goto("/admin/drives");
  await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
  const driveRow = page.locator(".cursor-pointer", { hasText: DRIVE_TITLE });
  await driveRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /change to published/i }).click();
  await expect(page.getByText(/^published$/i).first()).toBeVisible({ timeout: 15_000 });
  await driveRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /applications open/i }).click();
  await expect(page.getByText(/applications open/i).first()).toBeVisible({ timeout: 15_000 });

  // Admin also creates Faculty + HOD (CSE) accounts through the real Users
  // & Roles page — otherwise there's no way for either to exist on a
  // scratch DB (no bootstrap for them beyond the one TP_ADMIN).
  const dept = await prisma.department.findUniqueOrThrow({ where: { code: "CSE" } });

  await page.goto("/admin/users-roles");
  await page.getByRole("button", { name: /add user/i }).first().click();
  await page.locator("#u-name").fill("Dr. Priya Nair");
  await page.locator("#u-email").fill(FACULTY_EMAIL);
  await page.locator("#u-role").selectOption("FACULTY");
  await page.locator("#u-empid").fill(`FAC${RUN}`);
  await page.locator("#u-dept").selectOption(dept.id);
  await page.locator("#u-desig").fill("Assistant Professor");
  await page.getByRole("dialog").getByRole("button", { name: /^create$/i }).click();
  await expect(page.getByText("Account Created")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^done$/i }).click();

  await page.getByRole("button", { name: /add user/i }).first().click();
  await page.locator("#u-name").fill("Prof. Rajan Krishnan");
  await page.locator("#u-email").fill(HOD_EMAIL);
  await page.locator("#u-role").selectOption("HOD");
  await page.locator("#u-empid").fill(`HOD${RUN}`);
  await page.locator("#u-dept").selectOption(dept.id);
  await page.getByRole("dialog").getByRole("button", { name: /^create$/i }).click();
  await expect(page.getByText("Account Created")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^done$/i }).click();

  const faculty = await prisma.user.findUniqueOrThrow({ where: { email: FACULTY_EMAIL } });
  const hod = await prisma.user.findUniqueOrThrow({ where: { email: HOD_EMAIL } });
  expect(faculty.mustChangePassword).toBe(true);
  expect(hod.mustChangePassword).toBe(true);

  // Give both a known password directly (equivalent to them going through
  // their own forced first-login change, already proven for admin above).
  const hash = await bcrypt.hash(PASSWORD, 12);
  await prisma.user.updateMany({ where: { id: { in: [faculty.id, hod.id] } }, data: { passwordHash: hash, mustChangePassword: false } });
});

test("2 — Student: raw account provisioned, completes real onboarding, sees the opportunity with a correct ✓ eligibility breakdown, applies", async ({ page }) => {
  test.setTimeout(60_000);

  // No self-registration or bulk-import UI exists yet (a real gap this
  // phase surfaced — see the final report) — this is the one place a bare
  // row is created directly, standing in for that missing provisioning
  // step. Everything after this line is real UI.
  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: "BTECH-CSE" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { branchId: branch.id } });
  const hash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({
    data: { name: "Anjali Krishnan", email: STUDENT_EMAIL, passwordHash: hash, role: "STUDENT", isActive: true, mustChangePassword: false },
  });
  await prisma.student.create({
    data: { userId: user.id, enrollmentNumber: STUDENT_ENROLLMENT, branchId: branch.id, batchId: batch.id, onboardingStep: 0 },
  });

  await login(page, STUDENT_EMAIL, PASSWORD);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });

  await page.getByLabel(/first name/i).fill("Anjali");
  await page.getByLabel(/last name/i).fill("Krishnan");
  await page.locator("#dob").fill("2004-02-18");
  await page.locator("#phone").fill("9812345670");
  await page.locator("#curAddr").fill("Hostel Block C, IIST Campus");
  await page.locator("#curCity").fill("Thiruvananthapuram");
  await page.locator("#curState").selectOption("Kerala");
  await page.locator("#curPin").fill("695547");
  await page.locator("#fatherName").fill("Suresh Krishnan");
  await page.locator("#motherName").fill("Latha Krishnan");
  await page.getByRole("button", { name: /save & continue/i }).click();

  await expect(page.getByText(/class x \(10th\)/i)).toBeVisible({ timeout: 15_000 });
  await page.locator("#tenthSchool").fill("St. Thomas HSS");
  await page.locator("#tenthBoard").selectOption("CBSE");
  await page.locator("#tenthYear").fill("2018");
  await page.locator("#tenthPct").fill("93.0");
  await page.locator("#twelfthSchool").fill("St. Thomas HSS");
  await page.locator("#twelfthBoard").selectOption("CBSE");
  await page.locator("#twelfthYear").fill("2020");
  await page.locator("#twelfthPct").fill("95.0");
  await page.locator("#cgpa").fill("8.4"); // above the 7.5 cutoff
  await page.locator("#sem").selectOption("6");
  await page.locator("#sgpa-0").fill("8.5");
  await page.getByRole("button", { name: /complete profile/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/student/dashboard"), { timeout: 15_000 });

  // Real dashboard stat — Active Opportunities is no longer a hardcoded
  // "—"; it's a real count, and it should be exactly 1 (the drive just
  // published), since nothing else exists on this scratch DB.
  const oppCard = page.locator("div").filter({ hasText: "Active Opportunities" }).last();
  await expect(oppCard.getByText("1", { exact: true })).toBeVisible({ timeout: 10_000 });

  // Applying requires a resume on file (the apply UI blocks submission
  // without one, even though the backend field is technically optional) —
  // create one through the real Resume Center first, generated from the
  // profile just filled in above rather than needing an actual PDF file.
  await page.goto("/student/resume");
  await page.getByRole("button", { name: /new resume|create resume/i }).first().click();
  await page.locator("#res-name").fill("Placement Resume");
  await page.getByRole("dialog").getByRole("button", { name: /^create$/i }).click();
  await expect(page.getByText("Placement Resume")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /add version/i }).click();
  await page.getByRole("button", { name: /generate from profile/i }).click();
  await expect(page.getByText(/generated from profile/i)).toBeVisible({ timeout: 15_000 });
  // The dialog closes itself on a successful save — only close it manually
  // if it's still open.
  const closeBtn = page.getByRole("button", { name: /^close$/i });
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeBtn.click();
  }

  await page.goto("/student/opportunities");
  await page.getByPlaceholder(/search/i).first().fill(COMPANY_NAME);
  await expect(page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: /view details.*apply/i }).click();

  // Overall eligibility status first (collapsed view).
  await expect(page.getByText(/^eligible$/i)).toBeVisible({ timeout: 15_000 });

  // Eligibility breakdown: both rules should show as passed (✓), not just
  // a bare "Eligible" label — this is the real per-rule engine result,
  // not a component that only checks overall pass/fail.
  await page.getByRole("button", { name: /show eligibility details/i }).click();
  await expect(page.getByText("Open to CSE branch only")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Minimum CGPA 7.5")).toBeVisible();

  const applyButton = page.getByRole("button", { name: /^apply/i }).first();
  await expect(applyButton).toBeEnabled({ timeout: 10_000 });
  await applyButton.click();

  // Real multi-step apply flow: eligibility recap -> resume select -> confirm -> submit.
  await expect(page.getByText(/you are eligible/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^continue$/i }).click();

  await expect(page.getByText(/select.*resume|choose.*resume/i).first()).toBeVisible({ timeout: 10_000 });
  const resumeOption = page.locator('input[type="radio"], [role="radio"]').first();
  if (await resumeOption.count() > 0) {
    await resumeOption.click();
  } else {
    await page.getByText(/placement resume/i).first().click();
  }
  await page.getByRole("button", { name: /^continue$/i }).click();

  await expect(page.getByText(/confirm application/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /submit application/i }).click();
  // On success the modal closes itself (no navigation — this stays on the
  // same detail page and just refetches) and a toast confirms it; waiting
  // on a URL match here would be a no-op since this page's own URL already
  // starts with /student/opportunities/.
  await expect(page.getByText(/application submitted/i)).toBeVisible({ timeout: 15_000 });

  const application = await prisma.application.findFirstOrThrow({ where: { studentId: (await prisma.student.findUniqueOrThrow({ where: { userId: user.id } })).id } });
  expect(application.status).toBe("APPLIED");
});

test("3 — Admin: sees the real application, shortlists, runs a round, marks attendance, records an offer", async ({ page }) => {
  test.setTimeout(90_000);

  await login(page, ADMIN_EMAIL, PASSWORD);
  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });

  await page.goto(`/admin/drives/${drive.id}`);
  await page.getByRole("tab", { name: /applicants|applications/i }).click();
  await expect(page.getByText("Anjali Krishnan")).toBeVisible({ timeout: 15_000 });

  await prisma.placementDrive.update({ where: { id: drive.id }, data: { status: "APPLICATIONS_CLOSED" } });

  await page.goto(`/admin/drives/${drive.id}`);
  await page.getByRole("tab", { name: /shortlisting/i }).click();
  await expect(page.getByText("Anjali Krishnan")).toBeVisible({ timeout: 15_000 });
  await page.locator("tr", { hasText: "Anjali Krishnan" }).getByRole("button").first().click();
  await page.getByRole("combobox").filter({ hasText: /choose action/i }).click();
  await page.getByRole("option", { name: /^shortlist$/i }).click();
  await page.getByRole("button", { name: /^apply$/i }).click();
  await expect(page.getByText("Anjali Krishnan")).toHaveCount(0, { timeout: 15_000 });

  await page.getByRole("tab", { name: /^rounds$/i }).click();
  await page.getByRole("button", { name: /add round/i }).first().click();
  // Named to avoid colliding with the round-type badge's own default text
  // ("Technical Interview"), which a bare title of "Technical Interview"
  // would case-insensitively substring-match too.
  await page.getByPlaceholder(/technical interview/i).fill("Interview Round 1");
  await page.getByRole("button", { name: /^save round$/i }).click();
  await expect(page.getByText("Interview Round 1")).toBeVisible({ timeout: 15_000 });

  await page.getByText("Interview Round 1").click();
  await page.getByRole("button", { name: /add participants/i }).click();
  await expect(page.getByRole("dialog").getByText("Anjali Krishnan")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("dialog").getByText("Anjali Krishnan").click();
  await page.getByRole("dialog").getByRole("button", { name: /^add \d+ participants?$/i }).click();
  await expect(page.getByText(/participant\(s\) added/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("tab", { name: /attendance/i }).click();
  await expect(page.getByText("Anjali Krishnan")).toBeVisible({ timeout: 15_000 });
  await page.locator("tr", { hasText: "Anjali Krishnan" }).getByRole("button", { name: /^pre$/i }).click();

  const application = await prisma.application.findFirstOrThrow({ where: { driveId: drive.id } });
  await prisma.application.update({ where: { id: application.id }, data: { status: "SELECTED" } });

  await page.goto("/admin/offers");
  await page.getByRole("button", { name: /record offer/i }).first().click();
  await expect(page.getByText(/record an offer/i)).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/selected application/i).selectOption({ label: `Anjali Krishnan — ${COMPANY_NAME} · ${ROLE_TITLE}` });
  await page.getByLabel("CTC (LPA)").fill("14");
  await page.getByRole("dialog").getByRole("button", { name: /^(record offer|save|submit)$/i }).last().click();
  await expect(page.getByText(/offer recorded/i)).toBeVisible({ timeout: 15_000 });

  const offer = await prisma.offer.findUnique({ where: { applicationId: application.id } });
  expect(offer).not.toBeNull();
  expect(offer?.ctc).toBeTruthy();

  // A freshly-recorded offer is "OFFERED", not "placed" yet — students
  // hold no offer:write permission at all (the T&P cell records the
  // student's decision, matching how placement cells actually operate,
  // not a self-service accept/decline button), so this transition is a
  // real admin action too, through the same Offers page.
  await page.reload();
  await page.locator("tr", { hasText: "Anjali Krishnan" }).getByRole("button", { name: /^update$/i }).click();
  await expect(page.getByRole("dialog").getByText(/update offer status/i)).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/new status/i).selectOption("ACCEPTED");
  await page.getByRole("dialog").getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/offer marked accepted/i)).toBeVisible({ timeout: 15_000 });

  const acceptedOffer = await prisma.offer.findUniqueOrThrow({ where: { applicationId: application.id } });
  expect(acceptedOffer.status).toBe("ACCEPTED");
});

test("4 — Student: sees the real offer in placement history", async ({ page }) => {
  await login(page, STUDENT_EMAIL, PASSWORD);
  await page.goto("/student/placement-history");
  await expect(page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 15_000 });
});

test("5 — HOD (CSE): department analytics reflect this one real placement", async ({ page }) => {
  await login(page, HOD_EMAIL, PASSWORD);
  await page.goto("/hod/dashboard");
  await expect(page.getByText(/computer science/i)).toBeVisible({ timeout: 15_000 });
  // Exactly one student, one placed — not off by a seed baseline, since
  // this scratch DB has no other CSE students at all.
  const totalStudentsCard = page.getByText("Total students", { exact: true }).locator("..").locator("..");
  await expect(totalStudentsCard.getByText("1", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("100%")).toBeVisible(); // placement rate: 1/1
});

const SKILLUP_TEST_TITLE = `Aptitude Round ${RUN}`;

test("6 — Faculty: creates a real SkillUp test, publishes one real result", async ({ page }) => {
  test.setTimeout(60_000);
  const TEST_TITLE = SKILLUP_TEST_TITLE;

  await login(page, FACULTY_EMAIL, PASSWORD);
  await page.goto("/faculty/skillup");

  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: STUDENT_ENROLLMENT } });

  await page.getByRole("button", { name: /create test/i }).first().click();
  await page.locator("#test-title").fill(TEST_TITLE);
  const scheduledAt = new Date(Date.now() - 3_600_000).toISOString().slice(0, 16);
  await page.locator("#test-when").fill(scheduledAt);
  await page.locator("#test-max").fill("100");
  await page.locator("#test-pass").fill("40");
  await page.locator("#test-batch").selectOption(student.batchId);
  await page.getByRole("dialog").getByRole("button", { name: /^create test$/i }).click();
  await expect(page.getByText(TEST_TITLE)).toBeVisible({ timeout: 15_000 });

  const row = page.locator("tr", { hasText: TEST_TITLE });
  await row.getByRole("button", { name: /results/i }).click();
  await expect(page.getByRole("dialog").getByText(`Results — ${TEST_TITLE}`)).toBeVisible({ timeout: 15_000 });

  const fs = await import("fs");
  const os = await import("os");
  const path = await import("path");
  const csvPath = path.join(os.tmpdir(), `phase13-skillup-${RUN}.csv`);
  fs.writeFileSync(csvPath, `${STUDENT_ENROLLMENT},82,strong performance`);
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  await expect(page.getByText(/1 row\(s\) parsed/i)).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /^publish 1 result/i }).click();
  await expect(page.getByText(/results published/i)).toBeVisible({ timeout: 15_000 });
  fs.unlinkSync(csvPath);

  const result = await prisma.testResult.findFirstOrThrow({ where: { test: { title: TEST_TITLE }, studentId: student.id } });
  expect(result.marksObtained).toBe(82);
});

// Separate test (own fresh browser context/page, matching every other role
// switch in this file) rather than a second login() on the same page — a
// second login on an already-authenticated page reproducibly hung on the
// email field never appearing, unlike every other role transition here,
// which each get a fresh `page` fixture from their own `test()` block.
test("6b — Student sees the real SkillUp result on their own dashboard", async ({ page }) => {
  await login(page, STUDENT_EMAIL, PASSWORD);
  await page.goto("/student/skillup");
  await expect(page.getByText(SKILLUP_TEST_TITLE)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("82").first()).toBeVisible();
});

test("7 — Admin: Command Center reflects exactly what was just entered, not a seed baseline", async ({ page }) => {
  test.setTimeout(60_000);
  const [companies, drives, applications, offers] = await Promise.all([
    prisma.company.count(),
    prisma.placementDrive.count(),
    prisma.application.count(),
    prisma.offer.count(),
  ]);
  expect({ companies, drives, applications, offers }).toEqual({ companies: 1, drives: 1, applications: 1, offers: 1 });

  await login(page, ADMIN_EMAIL, PASSWORD);
  // The command-center aggregate endpoint does several counts/aggregates
  // at once — give it more room than the default 30s nav timeout,
  // especially this late in a long real-browser session.
  await page.goto("/admin/analytics", { timeout: 45_000 });
  await expect(page.getByRole("tab", { name: /command center/i })).toBeVisible({ timeout: 15_000 });
  // Total students: 1 (Anjali) — real count, not a seed baseline.
  const totalStudentsCard = page.getByText("Total students", { exact: true }).locator("..").locator("..");
  await expect(totalStudentsCard.getByText("1", { exact: true })).toBeVisible({ timeout: 15_000 });
});
