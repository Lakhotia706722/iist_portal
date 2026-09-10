import { test, expect } from "@playwright/test";
import { login, ACCOUNTS, PASSWORD } from "../helpers";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 11 — P1.1/P1.2. Invalid/malformed input and boundary values on
 * forms Phase 9/10 already covered on the happy path. Each of these
 * asserts a real, specific validation message renders and nothing is
 * submitted — not a raw 500, not a silent no-op.
 */

test("Onboarding: invalid phone number is rejected with a real validation message, not submitted", async ({ page }) => {
  test.setTimeout(60_000);
  const email = `e2e-negpath-onb-${Date.now()}@iist.ac.in`;
  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: "CSE" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { branchId: branch.id, academicYear: "2021-2025" } });
  const hash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({ data: { name: "E2E Negpath Onb", email, passwordHash: hash, role: "STUDENT", isActive: true } });
  await prisma.student.create({ data: { userId: user.id, enrollmentNumber: `E2ENEG${Date.now()}`, branchId: branch.id, batchId: batch.id, onboardingStep: 0 } });

  await login(page, email);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });

  await page.getByLabel(/first name/i).fill("Negpath");
  await page.getByLabel(/last name/i).fill("Tester");
  await page.locator("#dob").fill("2003-04-10");
  // Invalid: 10 digits but doesn't start with 6-9 — passes the maxLength
  // attribute (client can't block it that way) but must fail the real
  // `^[6-9]\d{9}$` schema check.
  await page.locator("#phone").fill("1234567890");
  await page.locator("#curAddr").fill("42 Test Lane");
  await page.locator("#curCity").fill("Thiruvananthapuram");
  await page.locator("#curState").selectOption("Kerala");
  await page.locator("#curPin").fill("695547");
  await page.locator("#fatherName").fill("Test Father");
  await page.locator("#motherName").fill("Test Mother");
  await page.getByRole("button", { name: /save & continue/i }).click();

  await expect(page.getByText(/enter a valid 10-digit indian mobile number/i)).toBeVisible({ timeout: 10_000 });
  // Still on step 1 — never actually submitted.
  await expect(page.getByText(/basic details/i)).toBeVisible();
  const student = await prisma.student.findUniqueOrThrow({ where: { userId: user.id } });
  expect(student.onboardingStep).toBe(0);
});

test("Onboarding: CGPA above the valid range (0-10) is rejected", async ({ page }) => {
  test.setTimeout(60_000);
  const email = `e2e-negpath-cgpa-${Date.now()}@iist.ac.in`;
  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: "CSE" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { branchId: branch.id, academicYear: "2021-2025" } });
  const hash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({ data: { name: "E2E Negpath CGPA", email, passwordHash: hash, role: "STUDENT", isActive: true } });
  await prisma.student.create({ data: { userId: user.id, enrollmentNumber: `E2ENEG${Date.now()}`, branchId: branch.id, batchId: batch.id, onboardingStep: 1, firstName: "X", lastName: "Y", phoneNumber: "9123456789", currentAddress: "a", currentCity: "b", currentState: "Kerala", currentPincode: "695547", fatherName: "F", motherName: "M" } });

  await login(page, email);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  await expect(page.getByText(/class x \(10th\)/i)).toBeVisible({ timeout: 15_000 });

  await page.locator("#tenthSchool").fill("Test HSS");
  await page.locator("#tenthBoard").selectOption("CBSE");
  await page.locator("#tenthYear").fill(String(new Date().getFullYear() - 6));
  await page.locator("#tenthPct").fill("90");
  await page.locator("#twelfthSchool").fill("Test HSS");
  await page.locator("#twelfthBoard").selectOption("CBSE");
  await page.locator("#twelfthYear").fill(String(new Date().getFullYear() - 4));
  await page.locator("#twelfthPct").fill("88");
  // Invalid: CGPA scale is 0-10.
  await page.locator("#cgpa").fill("11");
  await page.locator("#sgpa-0").fill("8.5");
  await page.getByRole("button", { name: /complete profile/i }).click();

  // The <input type="number" max={10}> attribute's native browser
  // validation intercepts submission before react-hook-form's Zod
  // resolver ever runs — confirm that real block (not a silent no-op or
  // a raw 500) via the input's own validity state, rather than the Zod
  // message this particular field never gets a chance to render.
  const cgpaValidity = await page.locator("#cgpa").evaluate((el: HTMLInputElement) => ({
    valid: el.validity.valid,
    rangeOverflow: el.validity.rangeOverflow,
  }));
  expect(cgpaValidity.valid).toBe(false);
  expect(cgpaValidity.rangeOverflow).toBe(true);
  const student = await prisma.student.findUniqueOrThrow({ where: { userId: user.id } });
  expect(student.onboardingStep).toBe(1); // unchanged — never advanced to step 2
});

test("SkillUp: passing marks above maximum marks is rejected", async ({ page }) => {
  test.setTimeout(60_000);
  const title = `E2E Negpath SkillUp ${Date.now()}`;
  await prisma.test.deleteMany({ where: { title } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/skillup");
  await page.getByRole("button", { name: /create test/i }).click();
  await page.locator("#test-title").fill(title);
  const scheduledAt = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  await page.locator("#test-when").fill(scheduledAt);
  await page.locator("#test-max").fill("50");
  // Invalid: passing marks (90) exceed max marks (50).
  await page.locator("#test-pass").fill("90");
  await page.getByRole("dialog").getByRole("button", { name: /^create test$/i }).click();

  await expect(page.getByText(/passing marks cannot exceed maximum marks/i).first()).toBeVisible({ timeout: 15_000 });
  const test_ = await prisma.test.findFirst({ where: { title } });
  expect(test_, "an invalid test was persisted despite failing its own passingMarks<=maxMarks rule").toBeNull();
});

test("Offers: joining date before the offer date is rejected", async ({ page }) => {
  test.setTimeout(60_000);

  // Self-contained fixture: its own student + drive + SELECTED application,
  // so the "Selected application" dropdown deterministically contains
  // exactly this one option regardless of ambient app state.
  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: "CSE" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { branchId: branch.id, academicYear: "2021-2025" } });
  const email = `e2e-negpath-joindate-${Date.now()}@iist.ac.in`;
  const hash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({ data: { name: "E2E Negpath Joindate", email, passwordHash: hash, role: "STUDENT", isActive: true } });
  const student = await prisma.student.create({ data: { userId: user.id, enrollmentNumber: `E2ENEG${Date.now()}`, branchId: branch.id, batchId: batch.id, onboardingStep: 2, firstName: "Join", lastName: "Date" } });
  const company = await prisma.company.create({ data: { name: `E2E Negpath JD Co ${Date.now()}`, slug: `e2e-negpath-jd-${Date.now()}`, industry: "TECHNOLOGY", isActive: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS.admin.email } });
  const drive = await prisma.placementDrive.create({ data: { companyId: company.id, title: `E2E Negpath JD Drive ${Date.now()}`, academicYear: "2025-2026", status: "APPLICATIONS_CLOSED", createdById: admin.id } });
  const role = await prisma.jobRole.create({ data: { driveId: drive.id, title: "E2E Negpath JD Role" } });
  const application = await prisma.application.create({ data: { studentId: student.id, driveId: drive.id, jobRoleId: role.id, status: "SELECTED" } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/offers");
  await page.getByRole("button", { name: /record offer/i }).click();
  await expect(page.getByText(/record an offer/i)).toBeVisible({ timeout: 15_000 });
  await page.locator("#offer-application").selectOption(application.id);
  await page.locator("#offer-ctc").fill("10");
  await page.locator("#offer-date").fill("2026-06-01");
  // Invalid: joining date predates the offer date.
  await page.locator("#offer-joining").fill("2026-05-01");
  await page.getByRole("dialog").getByRole("button", { name: /^record offer$/i }).click();

  await expect(page.getByText(/joining date cannot be before the offer date/i).first()).toBeVisible({ timeout: 15_000 });
  const offerCount = await prisma.offer.count({ where: { applicationId: application.id } });
  expect(offerCount, "an invalid offer (joining before offer date) was persisted anyway").toBe(0);
});

test("Offers: exceeding the max-active-offers-per-student policy is rejected", async ({ page }) => {
  test.setTimeout(60_000);

  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: "CSE" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { branchId: branch.id, academicYear: "2021-2025" } });
  const email = `e2e-negpath-offer-${Date.now()}@iist.ac.in`;
  const hash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({ data: { name: "E2E Negpath Offer", email, passwordHash: hash, role: "STUDENT", isActive: true } });
  const enrollment = `E2ENEG${Date.now()}`;
  const student = await prisma.student.create({ data: { userId: user.id, enrollmentNumber: enrollment, branchId: branch.id, batchId: batch.id, onboardingStep: 2, firstName: "Neg", lastName: "Path" } });

  const company = await prisma.company.create({ data: { name: `E2E Negpath Co ${Date.now()}`, slug: `e2e-negpath-co-${Date.now()}`, industry: "TECHNOLOGY", isActive: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS.admin.email } });
  const drive = await prisma.placementDrive.create({ data: { companyId: company.id, title: `E2E Negpath Drive ${Date.now()}`, academicYear: "2025-2026", status: "APPLICATIONS_CLOSED", createdById: admin.id } });
  const roleA = await prisma.jobRole.create({ data: { driveId: drive.id, title: "E2E Negpath Role A" } });
  const roleB = await prisma.jobRole.create({ data: { driveId: drive.id, title: "E2E Negpath Role B" } });

  // Student already has one active offer — default policy is
  // max_offers_per_student = 1, so a second SELECTED application should
  // be blocked from getting an offer recorded against it.
  const appA = await prisma.application.create({ data: { studentId: student.id, driveId: drive.id, jobRoleId: roleA.id, status: "SELECTED" } });
  await prisma.offer.create({ data: { applicationId: appA.id, studentId: student.id, driveId: drive.id, companyId: company.id, jobRoleId: roleA.id, type: "FULL_TIME", category: "NON_CORE", ctc: 10, offerDate: new Date(), status: "OFFERED", createdById: admin.id } });
  const appB = await prisma.application.create({ data: { studentId: student.id, driveId: drive.id, jobRoleId: roleB.id, status: "SELECTED" } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/offers");
  await page.getByRole("button", { name: /record offer/i }).click();
  await expect(page.getByText(/record an offer/i)).toBeVisible({ timeout: 15_000 });
  await page.locator("#offer-application").selectOption(appB.id);
  await page.locator("#offer-ctc").fill("12");
  await page.locator("#offer-date").fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("dialog").getByRole("button", { name: /^record offer$/i }).click();

  await expect(page.getByText(/already holds 1 active offer.*policy limit of 1/i).first()).toBeVisible({ timeout: 15_000 });
  const offerCount = await prisma.offer.count({ where: { studentId: student.id } });
  expect(offerCount, "a second offer was recorded despite the policy limit").toBe(1);
});
