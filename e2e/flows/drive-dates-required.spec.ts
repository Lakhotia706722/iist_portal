import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const COMPANY_NAME = `E2E Dates Co ${Date.now()}`;
const DRIVE_TITLE = `E2E Dates Drive ${Date.now()}`;

/**
 * Phase 17 P3 regression test: application opening/closing dates are a
 * locked-required field at drive creation (server AND client), because the
 * apply-flow's deadline/eligibility logic depends on them existing — a
 * drive created with blank dates used to render "Opens/Start/End: Not
 * specified" to students indefinitely. Confirms the real form actually
 * blocks submission without them, and that the API rejects a raw bypass.
 */
test("Drive creation rejects blank application dates, client and server side", async ({ page }) => {
  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });
  await prisma.company.create({ data: { name: COMPANY_NAME, slug: `e2e-dates-co-${Date.now()}`, industry: "TECHNOLOGY", isActive: true } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/drives");
  await page.getByRole("button", { name: /create drive/i }).click();
  await page.getByRole("combobox").filter({ hasText: /select company/i }).click();
  await page.getByRole("option", { name: COMPANY_NAME }).click();
  await page.getByLabel(/drive title/i).fill(DRIVE_TITLE);
  // Deliberately leave both date fields blank and try to submit.
  await page.getByRole("dialog").getByRole("button", { name: /^create drive$/i }).click();

  // Client-side validation blocks it: the dialog stays open, no drive row appears.
  await expect(page.getByRole("dialog")).toBeVisible();
  const created = await prisma.placementDrive.findFirst({ where: { title: DRIVE_TITLE } });
  expect(created, "a drive with blank dates must not be creatable").toBeNull();

  // Server-side: the API itself must also reject it (defense in depth,
  // not just a client-side gate a direct API call could bypass).
  const company = await prisma.company.findFirstOrThrow({ where: { name: COMPANY_NAME } });
  // page.request shares the browser context's session cookie, unlike the
  // standalone `request` fixture — needed since this route requires auth.
  const res = await page.request.post("/api/admin/drives", {
    headers: { "Content-Type": "application/json" },
    data: { companyId: company.id, title: DRIVE_TITLE, academicYear: "2024-2025", workMode: "ONSITE" },
    failOnStatusCode: false,
  });
  expect(res.status(), "API must reject a drive with no application dates").toBe(400);

  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });
});
