import { test, expect } from "@playwright/test";
import { login, ACCOUNTS, studentDisplayName } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const COMPANY_NAME = `E2E Search Audit Co ${Date.now()}`;

/**
 * Phase 10 — P2 flow 10. Two real admin-tooling surfaces, chained: (1) the
 * global topbar search finds a real, known student and navigates to their
 * real profile via a real result click; (2) creating a real company
 * through the real UI writes a real audit log row, which the audit log
 * viewer's own search+filter finds, and whose "View" detail panel shows
 * the real newValues diff — not a mocked/static example.
 */
test("Global search finds a real student and navigates to them", async ({ page }) => {
  test.setTimeout(60_000);

  const studentA = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  // Real display name, queried fresh — the shared Student A fixture's
  // name legitimately drifts from "E2E Student A" as real profile-edit
  // testing (manual or automated, any phase) renames it.
  const studentName = await studentDisplayName(prisma, ACCOUNTS.studentA.id);

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/dashboard");
  await page.getByLabel("Global search").fill(ACCOUNTS.studentA.id);
  // Search-by-enrollment-number also matches every application whose
  // title happens to include this student's name — scope to the one
  // result whose title is exactly the student's name (no " — <role>"
  // suffix), i.e. the real "student" type result.
  const escapedName = studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const studentResult = page.getByRole("link", { name: new RegExp(`^${escapedName} ${ACCOUNTS.studentA.id} ·`) });
  await expect(studentResult).toBeVisible({ timeout: 10_000 });
  await studentResult.click();
  await page.waitForURL((url) => url.pathname.includes(studentA.id), { timeout: 15_000 });
});

test("Audit log: a real action is searchable and its detail panel shows the real diff", async ({ page }) => {
  test.setTimeout(60_000);

  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });

  await login(page, ACCOUNTS.admin.id);

  // 1 — Produce a real, uniquely-named audit event through the real UI.
  await page.goto("/admin/companies");
  await page.getByRole("button", { name: /add company/i }).click();
  await page.getByLabel(/company name/i).fill(COMPANY_NAME);
  await page.getByRole("button", { name: /^create company$/i }).click();
  await page.getByPlaceholder(/search companies/i).fill(COMPANY_NAME);
  await expect(page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 15_000 });

  const company = await prisma.company.findFirstOrThrow({ where: { name: COMPANY_NAME } });
  const log = await prisma.auditLog.findFirstOrThrow({
    where: { entity: "Company", entityId: company.id, action: "CREATE" },
  });

  // 2 — The real audit log viewer's own search finds it. Its search box
  // only matches actor/entity/entity ID (per its own placeholder text),
  // not JSON diff content — search by entity ID, the field this action's
  // row is actually keyed on.
  await page.goto("/admin/audit-logs");
  await page.getByLabel(/search audit logs/i).fill(company.id);
  const row = page.locator("tr", { hasText: "Company" });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: /^view$/i }).click();

  // 3 — The detail panel shows the real newValues diff (the company name
  // this test actually created), not placeholder/mock content.
  await expect(page.getByRole("dialog").getByText(COMPANY_NAME)).toBeVisible({ timeout: 10_000 });
  if (log.ipAddress) {
    await expect(page.getByRole("dialog").getByText(log.ipAddress)).toBeVisible();
  }
});
