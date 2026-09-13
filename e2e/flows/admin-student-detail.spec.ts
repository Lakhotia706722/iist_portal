import { test, expect } from "@playwright/test";
import { login, trackConsoleErrors, expectNoConsoleErrors, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 17 P5: clicking a student's name in the admin Students list used to
 * go nowhere (no dedicated detail view existed — noted as a real gap in
 * Phase 15's own report). Now a real /admin/students/[id] page exists,
 * reusing the student's own CareerProfileView (unmasked for TP_ADMIN) plus
 * the existing Documents/Interviews/Compliance admin components scoped by
 * studentId, and a new overview endpoint for Applications/Offers/SkillUp/
 * Resumes — nothing here is a second, parallel rendering of the same data.
 */
test("Clicking a student's name from the admin list opens their real, unrestricted detail page", async ({ page }) => {
  const errors = trackConsoleErrors(page);
  const studentA = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/students");
  await page.getByPlaceholder(/search by name or enrollment/i).fill(ACCOUNTS.studentA.id);
  await expect(page.getByRole("link", { name: "E2E Student A" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "E2E Student A" }).click();
  await page.waitForURL(`**/admin/students/${studentA.id}`, { timeout: 15_000 });

  // Header shows the real student.
  await expect(page.getByRole("heading", { name: "E2E Student A" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(ACCOUNTS.studentA.id)).toBeVisible();

  // Profile tab (reused CareerProfileView) renders real data — including
  // contact info, which is masked for every other non-self viewer but
  // must NOT be masked here (the unrestricted-admin-view requirement).
  await expect(page.getByText("e2e-student-a@iist.ac.in")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("E2E Test Project")).toBeVisible();

  // Applications tab — real data from the new overview endpoint. Checks
  // against "E2E Shortlisted Drive" specifically: seed-e2e.ts guarantees
  // that application ("e2e-application-shortlisted") unconditionally,
  // unlike "E2E Test Drive"'s application, which only exists once
  // apply-flow.spec.ts has actually run — this suite runs alphabetically
  // (admin-student-detail before apply-flow), so asserting on the latter
  // is a real ordering bug, not just a fixture-name choice.
  await page.getByRole("tab", { name: "Applications" }).click();
  await expect(page.getByText("E2E Shortlisted Drive")).toBeVisible({ timeout: 15_000 });

  // Compliance tab — reused ComplianceView + IncidentsClient, scoped to this student.
  await page.getByRole("tab", { name: "Compliance" }).click();
  await expect(page.getByText(/compliance/i).first()).toBeVisible({ timeout: 15_000 });

  expectNoConsoleErrors(errors, "admin student detail page");
});

test("Admin students list has no dead-end rows left — every row links somewhere real", async ({ page }) => {
  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/students");
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });
  const firstLink = page.locator("table tbody tr").first().getByRole("link");
  await expect(firstLink).toHaveCount(1);
  const href = await firstLink.getAttribute("href");
  expect(href).toMatch(/^\/admin\/students\/.+/);
});
