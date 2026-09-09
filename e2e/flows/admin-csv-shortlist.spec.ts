import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const COMPANY_NAME = `E2E CSV Shortlist Co ${Date.now()}`;
const DRIVE_TITLE = `E2E CSV Shortlist Drive ${Date.now()}`;
const ROLE_TITLE = "E2E CSV Shortlist Engineer";

/**
 * Phase 10 — P0.2. Covers the gap the CSV-upload panel's own help text
 * documented but the backend never actually implemented: a real .csv file,
 * with an `action` column per row (shortlist/reject), uploaded through the
 * real UI file picker — not a raw API call with a hand-built JSON payload.
 * Before this fix the panel posted the file as multipart FormData to an
 * endpoint that only ever called request.json() on it, so this upload
 * button had never worked at all; see the comment on csvShortlistSchema in
 * lib/validations/placement.ts for the full history.
 */
test("CSV shortlist upload: real .csv file through the UI, mixed shortlist/reject rows, DB-verified", async ({ page }) => {
  test.setTimeout(60_000);

  // Self-cleaning, same pattern as admin-drive-lifecycle.spec.ts.
  const priorCompanies = await prisma.company.findMany({ where: { name: { contains: "E2E CSV Shortlist Co" } }, select: { id: true } });
  for (const c of priorCompanies) {
    const drives = await prisma.placementDrive.findMany({ where: { companyId: c.id }, select: { id: true } });
    for (const d of drives) {
      await prisma.roundParticipant.deleteMany({ where: { round: { driveId: d.id } } });
      await prisma.placementRound.deleteMany({ where: { driveId: d.id } });
      await prisma.offer.deleteMany({ where: { driveId: d.id } });
      await prisma.application.deleteMany({ where: { driveId: d.id } });
      await prisma.jobRole.deleteMany({ where: { driveId: d.id } });
      await prisma.placementDrive.delete({ where: { id: d.id } });
    }
    await prisma.company.delete({ where: { id: c.id } });
  }

  // Fixtures set up directly — company/drive/role creation and drive-status
  // progression through the real UI are already covered by
  // admin-drive-lifecycle.spec.ts; this test's focus is the CSV upload itself.
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS.admin.email } });
  const company = await prisma.company.create({
    data: { name: COMPANY_NAME, slug: `e2e-csv-shortlist-${Date.now()}`, industry: "TECHNOLOGY", isActive: true },
  });
  const drive = await prisma.placementDrive.create({
    data: { companyId: company.id, title: DRIVE_TITLE, academicYear: "2025-2026", status: "APPLICATIONS_CLOSED", createdById: adminUser.id },
  });
  const jobRole = await prisma.jobRole.create({
    data: { driveId: drive.id, title: ROLE_TITLE },
  });

  const studentA = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const studentB = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentB.id } });
  await prisma.application.deleteMany({ where: { studentId: { in: [studentA.id, studentB.id] }, jobRoleId: jobRole.id } });
  const appA = await prisma.application.create({
    data: { studentId: studentA.id, driveId: drive.id, jobRoleId: jobRole.id, status: "APPLIED" },
  });
  const appB = await prisma.application.create({
    data: { studentId: studentB.id, driveId: drive.id, jobRoleId: jobRole.id, status: "APPLIED" },
  });

  // A real CSV file on disk, matching the panel's documented columns
  // exactly: enrollmentNumber, action (shortlist/reject), note.
  const csvPath = path.join(os.tmpdir(), `e2e-shortlist-${Date.now()}.csv`);
  fs.writeFileSync(
    csvPath,
    [
      "enrollmentNumber,action,note",
      `${ACCOUNTS.studentA.id},shortlist,E2E shortlisted via CSV`,
      `${ACCOUNTS.studentB.id},reject,E2E rejected via CSV`,
    ].join("\n")
  );

  await login(page, ACCOUNTS.admin.id);
  // The navigation immediately after a fresh login has repeatedly hit
  // ERR_CONNECTION_REFUSED in this sandbox even though the dev server
  // itself answers a direct curl instantly at the same moment — a
  // transient client-side networking blip right after the credentials
  // POST/redirect chain, not a real server outage. Retry once.
  try {
    await page.goto(`/admin/drives/${drive.id}`);
  } catch {
    await page.goto(`/admin/drives/${drive.id}`);
  }
  await page.getByRole("tab", { name: /shortlisting/i }).click();
  await expect(page.getByText(ACCOUNTS.studentA.id)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /csv upload/i }).click();
  await expect(page.getByText(/enrollmentNumber/i)).toBeVisible();
  // The file input is visually hidden (opened via a "Choose CSV" button
  // that programmatically clicks it) — Playwright can still target it
  // directly by its type, which is the standard way to drive a
  // click-to-open file picker without a real OS dialog.
  await page.locator('input[type="file"]').setInputFiles(csvPath);

  await expect(page.getByText(/1 shortlisted, 1 rejected, 0 not found/i)).toBeVisible({ timeout: 15_000 });

  // DB-verified end state — no manual DB intervention was needed to reach
  // it, only to seed the two starting applications above.
  const [resultA, resultB] = await Promise.all([
    prisma.application.findUniqueOrThrow({ where: { id: appA.id } }),
    prisma.application.findUniqueOrThrow({ where: { id: appB.id } }),
  ]);
  expect(resultA.status).toBe("SHORTLISTED");
  expect(resultB.status).toBe("REJECTED");

  const historyA = await prisma.applicationStatusHistory.findFirst({
    where: { applicationId: appA.id, toStatus: "SHORTLISTED" },
    orderBy: { createdAt: "desc" },
  });
  expect(historyA?.note).toBe("E2E shortlisted via CSV");

  fs.unlinkSync(csvPath);
});
