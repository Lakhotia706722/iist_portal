import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 12 — "Personal & Academic" had no page at all (nav-config.tsx
 * flagged it comingSoon). It reuses the onboarding forms/endpoints
 * as-is, but this is the first time that reuse — as a standalone
 * post-onboarding edit surface, not the wizard — is ever exercised.
 */
test("Student profile edit: change father's occupation through the real form, persists", async ({ page }) => {
  test.setTimeout(45_000);

  const NEW_VALUE = `E2E Occupation ${Date.now()}`;

  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/profile");

  await expect(page.getByRole("button", { name: "Personal Info" })).toBeVisible({ timeout: 15_000 });
  await page.locator("#fatherOcc").fill(NEW_VALUE);
  await page.getByRole("button", { name: /save changes/i }).click();

  await expect(page.getByText(/updated/i)).toBeVisible({ timeout: 15_000 });

  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  expect(student.fatherOccupation).toBe(NEW_VALUE);

  // onboardingStep must not regress for an already-onboarded student —
  // the exact hazard savePersonalInfo's Math.max guard exists to prevent.
  expect(student.onboardingStep).toBeGreaterThanOrEqual(2);
});
