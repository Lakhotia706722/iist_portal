import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { login, PASSWORD, trackConsoleErrors, expectNoConsoleErrors } from "../helpers";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const EMAIL = `e2e-onboarding-${Date.now()}@iist.ac.in`;
const ENROLLMENT = `E2EONB${Date.now()}`.slice(0, 14);

/**
 * Phase 10 — P2 flow 1. A student who has never touched the wizard: fresh
 * user + Student row at onboardingStep 0, no profile fields at all — not
 * the rich, already-onboarded seed fixture every other test reuses. Drives
 * both real wizard steps (personal info -> academic info, incl. a real
 * SGPA field-array row) through the UI and DB-verifies the end state:
 * onboardingStep advanced, profile fields actually persisted, and the
 * student lands on their real dashboard afterward — not just a redirect.
 */
test("Student onboarding: fresh account through both wizard steps, DB-verified", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = trackConsoleErrors(page);

  // Self-cleaning
  const prior = await prisma.user.findMany({ where: { email: { contains: "e2e-onboarding-" } }, select: { id: true } });
  for (const u of prior) {
    await prisma.student.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }

  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: "CSE" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { branchId: branch.id, academicYear: "2021-2025" } });

  const hash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({
    data: { name: "E2E Onboarding Student", email: EMAIL, passwordHash: hash, role: "STUDENT", isActive: true, mustChangePassword: false },
  });
  await prisma.student.create({
    data: { userId: user.id, enrollmentNumber: ENROLLMENT, branchId: branch.id, batchId: batch.id, onboardingStep: 0 },
  });

  // login() only asserts we've left /login, which is true whether we land
  // on /onboarding (this account, step 0) or /dashboard — assert the
  // onboarding redirect specifically right after.
  await login(page, EMAIL);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });

  // Step 1 — Personal Info. Fill every required field the schema demands.
  await page.getByLabel(/first name/i).fill("Onboarding");
  await page.getByLabel(/last name/i).fill("Tester");
  await page.locator("#dob").fill("2003-04-10");
  await page.locator("#phone").fill("9123456780");
  await page.locator("#curAddr").fill("42 Test Lane");
  await page.locator("#curCity").fill("Thiruvananthapuram");
  await page.locator("#curState").selectOption("Kerala");
  await page.locator("#curPin").fill("695547");
  await page.locator("#fatherName").fill("Test Father");
  await page.locator("#motherName").fill("Test Mother");
  await page.getByRole("button", { name: /save & continue/i }).click();

  // Step 2 — Academic Info.
  await expect(page.getByText(/class x \(10th\)/i)).toBeVisible({ timeout: 15_000 });
  await page.locator("#tenthSchool").fill("Test Higher Secondary");
  await page.locator("#tenthBoard").selectOption("CBSE");
  await page.locator("#tenthYear").fill(String(new Date().getFullYear() - 6));
  await page.locator("#tenthPct").fill("91.5");
  await page.locator("#twelfthSchool").fill("Test Higher Secondary");
  await page.locator("#twelfthBoard").selectOption("CBSE");
  await page.locator("#twelfthYear").fill(String(new Date().getFullYear() - 4));
  await page.locator("#twelfthPct").fill("88.2");
  await page.locator("#cgpa").fill("8.4");
  await page.locator("#sem").selectOption("3");
  await page.locator("#sgpa-0").fill("8.5");
  await page.getByRole("button", { name: /complete profile/i }).click();

  // Real navigation to the real student dashboard — not just a toast.
  await page.waitForURL((url) => url.pathname.startsWith("/student/dashboard"), { timeout: 15_000 });

  // DB-verified end state.
  const student = await prisma.student.findUniqueOrThrow({
    where: { userId: user.id },
    include: { academicRecord: { include: { sgpaRecords: true } } },
  });
  expect(student.onboardingStep).toBe(2);
  expect(student.firstName).toBe("Onboarding");
  expect(student.phoneNumber).toBe("9123456780");
  expect(student.academicRecord?.currentCgpa).toBe(8.4);
  // The SGPA field-array row keeps its own default semester (1) —
  // #sem-0 selects the row's semester in the field array, distinct from
  // #sem which is "Current Semester" above it (set to 3 already asserted
  // via currentSemester below); only the row's SGPA value was filled here.
  expect(student.academicRecord?.currentSemester).toBe(3);
  expect(student.academicRecord?.sgpaRecords.some((r) => r.semester === 1 && r.sgpa === 8.5)).toBe(true);

  await expectNoConsoleErrors(errors, "/onboarding + /student/dashboard");
});
