import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 10 — P2 flow 11. Portal isolation via actual browser URL
 * navigation — not an API-level assertion (Phase 7 already covered that
 * with two real accounts each; this closes the "not just API assertions"
 * gap the last report named). Two real cross-tenant attempts:
 *   1. Company-Rep B pastes Company-Rep A's own drive detail URL
 *      (a drive that genuinely exists, just under a different company)
 *      directly into the address bar.
 *   2. HOD (AE) pastes an admin-only per-student URL directly into the
 *      address bar.
 * Both must be blocked by a real page load, not a client-side guess.
 */
test("Portal isolation: Company-Rep B cannot open Company-Rep A's drive via direct URL", async ({ page }) => {
  const driveA = await prisma.placementDrive.findUniqueOrThrow({
    where: { id: "e2e-drive-1" },
    include: { company: true },
  });

  await login(page, ACCOUNTS.repB.id);
  await page.goto(`/company/drives/${driveA.id}`);

  // Blocked: the real ErrorState renders (the API 404s on a foreign
  // company's drive id), and none of Company A's real drive data ever
  // reaches the page.
  await expect(page.getByText(/something went wrong/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(driveA.title)).toHaveCount(0);
  await expect(page.getByText(driveA.company.name)).toHaveCount(0);
});

test("Portal isolation: HOD cannot open an admin-only per-student URL", async ({ page }) => {
  const studentA = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });

  await login(page, ACCOUNTS.hodAe.id);
  await page.goto(`/admin/compliance/${studentA.id}`);

  // Blocked at the route level, before the admin-only page (or any of its
  // data) ever renders.
  await page.waitForURL((url) => url.pathname === "/unauthorized", { timeout: 15_000 });
  await expect(page.getByText(/eligible|conditional|restricted|placed|debarred/i)).toHaveCount(0);
});
