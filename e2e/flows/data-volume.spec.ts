import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 11 — P3. Real-browser confirmation of the shortlisting table's
 * pagination fix (see the comment on drive-shortlisting.tsx) against the
 * volume dataset from scripts/seed-volume.ts (a drive with 120
 * applications) — before this phase, everything past the 100th
 * applicant was completely invisible with no way to reach it at all.
 *
 * Run `npx tsx scripts/seed-volume.ts` before this spec.
 */
test("Shortlisting table paginates a 120-applicant drive instead of truncating silently at 100", async ({ page }) => {
  test.setTimeout(60_000);
  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: "E2E Volume Drive" } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto(`/admin/drives/${drive.id}`);
  await page.getByRole("tab", { name: /shortlisting/i }).click();
  await expect(page.getByText(/120 applicants total/i)).toBeVisible({ timeout: 20_000 });

  // Page 1: exactly 100 data rows, a pagination indicator, Previous
  // disabled, Next enabled.
  await expect(page.locator("tbody tr")).toHaveCount(100, { timeout: 15_000 });
  await expect(page.getByText(/1.100 of 120/i)).toBeVisible();
  // Anchor on the "1-100 of 120" summary text itself (unambiguous) and
  // find the Previous/Next buttons as its sibling — far more robust than
  // a CSS-class structural selector, which matched the wrong element
  // (the page also has an unrelated sidebar-collapse button and a
  // dev-only TanStack Query DevTools toggle in the same corner).
  const paginationBar = page.getByText(/of 120/).locator("..");
  const prevButton = paginationBar.getByRole("button").first();
  const nextButton = paginationBar.getByRole("button").last();
  await expect(prevButton).toBeDisabled();
  await expect(nextButton).toBeEnabled();

  // Page 2: the remaining 20 — previously unreachable at any volume above 100.
  // A dev-only TanStack Query DevTools floating toggle sits fixed in the
  // same bottom-right corner this pagination bar scrolls into, and real
  // browser hit-testing routes even a Playwright force-click there
  // instead — not a real app issue. A raw DOM .click() sidesteps
  // coordinate-based hit-testing entirely.
  await nextButton.evaluate((el) => (el as HTMLElement).click());
  await expect(page.getByText(/101.120 of 120/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("tbody tr")).toHaveCount(20, { timeout: 15_000 });
  await expect(nextButton).toBeDisabled();
  await expect(prevButton).toBeEnabled();
});
