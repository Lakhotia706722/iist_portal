import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const EMAIL = `e2e-compliance-${Date.now()}@iist.ac.in`;
const ENROLLMENT = `E2ECMP${Date.now()}`.slice(0, 14);

/**
 * Phase 10 — P2 flow 8. A dedicated, clean-slate student (not one of the
 * shared studentA/studentB fixtures other tests mutate, to avoid any
 * cross-test contamination of offers/incidents affecting the derived
 * status here) — real UI: record a HIGH-severity incident -> real
 * server-derived status flips to RESTRICTED; apply an admin override to
 * ELIGIBLE -> status shows overridden with the override's own reason, not
 * the derived one; clear the override -> status reverts to the derived
 * RESTRICTED, proving the override was a real, separate layer and not
 * just a coincidental match.
 */
test("Compliance: incident drives derived status, override is a real distinct layer", async ({ page }) => {
  test.setTimeout(60_000);

  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: "CSE" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { branchId: branch.id, academicYear: "2021-2025" } });
  const priorUsers = await prisma.user.findMany({ where: { email: { contains: "e2e-compliance-" } }, select: { id: true } });
  for (const u of priorUsers) {
    await prisma.student.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  const user = await prisma.user.create({
    data: { name: "E2E Compliance Student", email: EMAIL, passwordHash: "x", role: "STUDENT", isActive: true },
  });
  const student = await prisma.student.create({
    data: { userId: user.id, enrollmentNumber: ENROLLMENT, branchId: branch.id, batchId: batch.id, onboardingStep: 2, firstName: "E2E", lastName: "Compliance" },
  });

  await login(page, ACCOUNTS.admin.id);

  // 1 — Baseline: no incidents, no override -> ELIGIBLE.
  await page.goto(`/admin/compliance/${student.id}`);
  await expect(page.getByText(/^eligible$/i)).toBeVisible({ timeout: 15_000 });

  // 2 — Record a HIGH-severity incident through the real form.
  await page.getByRole("button", { name: /record incident/i }).click();
  await page.locator("#inc-type").selectOption("ATTENDANCE");
  await page.locator("#inc-severity").selectOption("HIGH");
  await page.locator("#inc-date").fill(new Date().toISOString().slice(0, 10));
  await page.locator("#inc-desc").fill("E2E: repeated no-shows at scheduled placement rounds.");
  await page.getByRole("dialog").getByRole("button", { name: /^record incident$/i }).click();
  await expect(page.getByText(/incident recorded/i)).toBeVisible({ timeout: 15_000 });

  const incident = await prisma.disciplineIncident.findFirstOrThrow({ where: { studentId: student.id } });
  expect(incident.severity).toBe("HIGH");
  expect(incident.status).toBe("OPEN");

  // 3 — Real derived-status effect: a real, open HIGH-severity incident
  // makes the server compute RESTRICTED, not a client-side guess.
  await expect(page.getByText(/^restricted$/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/1 open high-severity incident/i)).toBeVisible();

  // 4 — Admin override to ELIGIBLE — a distinct layer, not just editing
  // the derived computation: the UI must show it's overridden, with the
  // override's own reason, not the incident-derived one.
  await page.getByRole("button", { name: /^override$/i }).click();
  await page.locator("#override-status").selectOption("ELIGIBLE");
  await page.locator("#override-reason").fill("E2E: incident under review, cleared for now by TPO decision.");
  await page.getByRole("dialog").getByRole("button", { name: /apply override/i }).click();
  await expect(page.getByText(/compliance status overridden/i)).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText(/^eligible$/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/manually overridden/i)).toBeVisible();
  await expect(page.getByText("E2E: incident under review, cleared for now by TPO decision.").first()).toBeVisible();

  const override = await prisma.complianceOverride.findUniqueOrThrow({ where: { studentId: student.id } });
  expect(override.status).toBe("ELIGIBLE");

  // 5 — Clearing the override reveals the underlying derived status is
  // still RESTRICTED — the incident was never actually resolved, only
  // masked by the override layer.
  await page.getByRole("button", { name: /clear override/i }).click();
  await page.getByRole("button", { name: /^clear override$/i }).last().click();
  await expect(page.getByText(/^restricted$/i)).toBeVisible({ timeout: 15_000 });

  const overrideAfterClear = await prisma.complianceOverride.findUnique({ where: { studentId: student.id } });
  expect(overrideAfterClear).toBeNull();
});
