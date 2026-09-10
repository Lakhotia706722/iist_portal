import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 11 — P1.4. Rapid double-submission on real mutation buttons.
 * Most of the app's mutation buttons already disable while their own
 * TanStack Query mutation is pending (bulk shortlist, attendance,
 * offer/test/incident/event creation — sampled and confirmed). The one
 * real gap found: application-flow.tsx's final "Submit Application"
 * button had no such guard at all — fixed as part of this phase (see the
 * comment on that button). This test drives it with a real double-click,
 * through the actual UI, and confirms exactly one Application row exists
 * either way.
 */
test("Apply flow: rapid double-click on Submit Application creates exactly one Application", async ({ page }) => {
  test.setTimeout(60_000);

  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  await prisma.application.deleteMany({ where: { studentId: student.id, jobRole: { title: "E2E Software Engineer" } } });

  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/opportunities");
  await expect(page.getByText("E2E Test Drive")).toBeVisible({ timeout: 15_000 });
  await page.locator('a[href="/student/opportunities/e2e-drive-1"]').click();
  await page.waitForURL("**/student/opportunities/e2e-drive-1", { timeout: 15_000 });

  const applyButton = page.getByRole("button", { name: /^apply/i }).first();
  await expect(applyButton).toBeEnabled({ timeout: 10_000 });
  await applyButton.click();
  await expect(page.getByText(/you are eligible/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^continue$/i }).click();
  await expect(page.getByText(/select.*resume|choose.*resume/i).first()).toBeVisible({ timeout: 10_000 });
  const resumeOption = page.locator('input[type="radio"], [role="radio"]').first();
  if ((await resumeOption.count()) > 0) await resumeOption.click();
  else await page.getByText(/e2e resume/i).first().click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await expect(page.getByText(/confirm application/i)).toBeVisible({ timeout: 10_000 });

  const submitButton = page.getByRole("button", { name: /submit application/i });
  // Real rapid double-click — faster than a human, exactly the stress
  // case that would race two concurrent POSTs against the button's own
  // disabled-while-pending guard.
  await submitButton.dblclick({ timeout: 10_000 }).catch(() => {
    // If the button already vanished (step transitioned) before the
    // second click could land, that's the guard working even better than
    // expected — not a test failure.
  });

  // waitForURL's regex matches the *current* URL immediately (we're
  // already on /student/opportunities/e2e-drive-1), so it resolves
  // without waiting for the actual submit to finish — a real navigation
  // (like apply-flow.spec.ts does) is what actually synchronizes with
  // the mutation completing. Poll the DB rather than trust either.
  await page.goto("/student/applications");
  await expect
    .poll(async () => {
      const apps = await prisma.application.findMany({ where: { studentId: student.id, jobRole: { title: "E2E Software Engineer" } } });
      return apps.length;
    }, { timeout: 15_000 })
    .toBeGreaterThan(0);

  const applications = await prisma.application.findMany({ where: { studentId: student.id, jobRole: { title: "E2E Software Engineer" } } });
  expect(applications, "double-click created more than one Application row").toHaveLength(1);
  expect(applications[0].status).toBe("APPLIED");
});

/**
 * Deterministic companion to the UI test above: fires two genuinely
 * concurrent POSTs (not timing-dependent on a click racing a re-render)
 * to confirm the server-side safety net itself — the pre-check-then-
 * insert in applyForJobRole() plus handleApiError's P2002 handling —
 * holds under true concurrency, not just sequential double-submission.
 */
test("Apply flow: two genuinely concurrent apply requests — exactly one succeeds, the other fails cleanly (not a 500)", async ({ page }) => {
  test.setTimeout(30_000);

  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  await prisma.application.deleteMany({ where: { studentId: student.id, jobRole: { title: "E2E Software Engineer" } } });
  const jobRole = await prisma.jobRole.findFirstOrThrow({ where: { title: "E2E Software Engineer" } });
  const resumeVersion = await prisma.resumeVersion.findFirstOrThrow({ where: { resume: { studentId: student.id } } });

  await login(page, ACCOUNTS.studentA.id);

  const body = { jobRoleId: jobRole.id, resumeVersionId: resumeVersion.id, confirmed: true };
  const [r1, r2] = await Promise.all([
    page.request.post("/api/student/applications", { data: body }),
    page.request.post("/api/student/applications", { data: body }),
  ]);

  const statuses = [r1.status(), r2.status()].sort();
  // Exactly one 201 (created), and the other a clean 4xx — never a 500.
  expect(statuses[0]).toBeLessThan(500);
  expect(statuses[1]).toBeLessThan(500);
  expect(statuses.filter((s) => s === 201)).toHaveLength(1);

  const applications = await prisma.application.findMany({ where: { studentId: student.id, jobRoleId: jobRole.id } });
  expect(applications, "concurrent requests created more than one Application row").toHaveLength(1);
});
