import { test, expect } from "@playwright/test";
import { login, trackConsoleErrors, expectNoConsoleErrors, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.afterAll(() => prisma.$disconnect());

test("Opportunity -> Apply flow: browse, see real eligibility, apply, confirm in My Applications, confirm in DB", async ({ page }) => {
  // Idempotency: delete any application from a previous run of this test so
  // re-running the suite doesn't hit "already applied" from stale state.
  const studentForCleanup = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  await prisma.application.deleteMany({
    where: { studentId: studentForCleanup.id, jobRole: { title: "E2E Software Engineer" } },
  });

  const errors = trackConsoleErrors(page);
  await login(page, ACCOUNTS.studentA.id);

  // 1 — Browse opportunities, find the fixture drive.
  await page.goto("/student/opportunities");
  await expect(page.getByText("E2E Test Drive")).toBeVisible({ timeout: 15_000 });
  // Multiple opportunity cards can be on the page (other fixtures from
  // other test suites) — target the fixture drive's link by its known id
  // rather than a text-scoped ancestor, which is more robust either way.
  await page.locator('a[href="/student/opportunities/e2e-drive-1"]').click();
  await page.waitForURL("**/student/opportunities/e2e-drive-1", { timeout: 15_000 });

  // 2 — Real eligibility breakdown renders (Student A has CGPA 8.5, rule is >= 7).
  await expect(page.getByText(/eligible/i).first()).toBeVisible({ timeout: 15_000 });

  // 3 — Apply flow: click Apply, select resume, review, submit.
  const applyButton = page.getByRole("button", { name: /^apply/i }).first();
  await expect(applyButton).toBeEnabled({ timeout: 10_000 });
  await applyButton.click();

  // The apply modal's first step is an eligibility recap ("You are
  // eligible!") with its own "Continue" button before the resume step.
  await expect(page.getByText(/you are eligible/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Resume step
  await expect(page.getByText(/select.*resume|choose.*resume/i).first()).toBeVisible({ timeout: 10_000 });
  const resumeOption = page.locator('input[type="radio"], [role="radio"]').first();
  if (await resumeOption.count() > 0) {
    await resumeOption.click();
  } else {
    // Some resume-list UIs are clickable cards, not radio inputs.
    await page.getByText(/e2e resume/i).first().click();
  }
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Confirmation step — no interactive consent checkbox in this UI (verified
  // by reading application-flow.tsx): the review step's "By submitting..."
  // text is static, and confirmed:true is sent unconditionally on submit.
  // This is a legitimate design, not a stub — documented, not "fixed".
  await expect(page.getByText(/confirm application/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /submit application/i }).click();

  // 4 — Confirm it appears in My Applications with the right status.
  await page.waitForURL(/\/student\/opportunities/, { timeout: 15_000 });
  await page.goto("/student/applications");
  await expect(page.getByText("E2E Test Drive")).toBeVisible({ timeout: 15_000 });

  // 5 — DB-verified end state: a real Application row exists, status APPLIED.
  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const application = await prisma.application.findFirst({
    where: { studentId: student.id, jobRole: { title: "E2E Software Engineer" } },
  });
  expect(application, "no Application row was created in the DB").not.toBeNull();
  expect(application?.status).toBe("APPLIED");

  expectNoConsoleErrors(errors, "apply flow");
});
