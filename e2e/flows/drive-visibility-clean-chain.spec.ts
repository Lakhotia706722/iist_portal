import { test, expect } from "@playwright/test";
import { login, trackConsoleErrors, expectNoConsoleErrors, ACCOUNTS, fillRequiredDriveDates } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const RUN = Date.now();
const COMPANY_NAME = `P2 Chain Co ${RUN}`;
const DRIVE_TITLE = `P2 Chain Drive ${RUN}`;
const ROLE_TITLE = "P2 Chain Engineer";

/**
 * Phase 18 P2 — a real report ("published drive, 0 job roles, Applications
 * Open date of tomorrow — nothing shows to students") turned out to be two
 * separate, confirmed root causes plus one bug this test's own setup
 * exposed:
 *
 * 1. A drive stuck at PUBLISHED (one manual status step short of
 *    APPLICATIONS_OPEN) is correctly invisible to students — a genuine UX
 *    gap, not a bug (see the new banner on the admin drive overview page).
 * 2. listActiveOpportunities() never checked applicationOpenAt at all — a
 *    drive scheduled for the future was actually showing immediately, the
 *    opposite direction of the report but a real bug (fixed).
 * 3. drive-form.tsx's date pickers disabled "today" for the entire rest of
 *    the day (comparing against the exact instant, not the start of the
 *    day) — found while trying to build this exact test ("Applications
 *    Open date of today"), which the original report's own suggested
 *    isolation test explicitly calls for. Fixed alongside.
 *
 * This test proves the real fix: company -> drive (opens TODAY, through
 * the real, now-unblocked date picker) -> job role -> publish through both
 * manual status steps -> a real student sees it, searches for it, and
 * completes the real apply flow — zero manual DB intervention beyond
 * fixture cleanup.
 */
test("Full chain: company -> drive (opens today) -> role -> publish -> student sees, searches, and applies", async ({ page }) => {
  test.setTimeout(90_000);

  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });
  const studentForCleanup = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  await prisma.application.deleteMany({ where: { studentId: studentForCleanup.id, jobRole: { title: ROLE_TITLE } } });

  const errors = trackConsoleErrors(page);
  await login(page, ACCOUNTS.admin.id);

  // 1 — Create a company through the real form.
  await page.goto("/admin/companies");
  await page.getByRole("button", { name: /add company/i }).click();
  await page.getByLabel(/company name/i).fill(COMPANY_NAME);
  await page.getByRole("button", { name: /^create company$/i }).click();
  await page.getByPlaceholder(/search companies/i).fill(COMPANY_NAME);
  await expect(page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 15_000 });

  // 2 — Create a drive, opening TODAY (not tomorrow — the exact scenario
  // the original report's own isolation test calls for; only possible
  // through the real UI now that "today" isn't disabled anymore).
  await page.goto("/admin/drives");
  await page.getByRole("button", { name: /create drive/i }).click();
  await page.getByRole("combobox").filter({ hasText: /select company/i }).click();
  await page.getByRole("option", { name: COMPANY_NAME }).click();
  await page.getByLabel(/drive title/i).fill(DRIVE_TITLE);
  await fillRequiredDriveDates(page); // opens today, closes in the future
  await page.getByRole("dialog").getByRole("button", { name: /^create drive$/i }).click();
  await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
  await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });

  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });

  // 3 — Add a job role through the real form (a drive with zero roles is
  // now blocked from publishing at all — see step 4).
  await page.goto(`/admin/drives/${drive.id}`);
  await page.getByRole("tab", { name: /roles/i }).click();
  await page.getByRole("button", { name: /add job role/i }).first().click();
  await page.getByLabel(/role title/i).fill(ROLE_TITLE);
  await page.getByRole("dialog").getByRole("button", { name: /^create role$/i }).click();
  await expect(page.getByText(ROLE_TITLE)).toBeVisible({ timeout: 15_000 });

  // 4 — Publish through both real manual status steps.
  await page.goto("/admin/drives");
  await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
  await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });
  const driveRow = page.locator(".cursor-pointer", { hasText: DRIVE_TITLE });
  await driveRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /change to published/i }).click();
  await expect(page.getByText(/^published$/i).first()).toBeVisible({ timeout: 15_000 });
  await driveRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /applications open/i }).click();
  await expect(page.getByText(/applications open/i).first()).toBeVisible({ timeout: 15_000 });

  // 5 — Admin overview shows no "not visible yet" banner — both real root
  // causes (missing role, future-only visibility) are actually resolved,
  // not just individually plausible.
  await page.goto(`/admin/drives/${drive.id}`);
  await expect(
    page.getByText(/becomes visible to students on|has no job roles yet|still a draft|not yet open for applications/i)
  ).toHaveCount(0);

  // 6 — A real student browses, searches, and sees it via the actual
  // Opportunities page (not a direct DB check).
  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/opportunities");
  await page.getByPlaceholder(/search opportunities/i).fill(DRIVE_TITLE);
  await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });

  // 7 — Real apply flow end to end (same steps as apply-flow.spec.ts).
  await page.getByText(DRIVE_TITLE).click();
  await page.waitForURL(`**/student/opportunities/${drive.id}`, { timeout: 15_000 });
  await expect(page.getByText(/eligible/i).first()).toBeVisible({ timeout: 15_000 });

  const applyButton = page.getByRole("button", { name: /^apply/i }).first();
  await expect(applyButton).toBeEnabled({ timeout: 10_000 });
  await applyButton.click();

  await expect(page.getByText(/you are eligible/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^continue$/i }).click();

  await expect(page.getByText(/select.*resume|choose.*resume/i).first()).toBeVisible({ timeout: 10_000 });
  const resumeOption = page.locator('input[type="radio"], [role="radio"]').first();
  if (await resumeOption.count() > 0) {
    await resumeOption.click();
  } else {
    await page.getByText(/e2e resume/i).first().click();
  }
  await page.getByRole("button", { name: /^continue$/i }).click();

  await expect(page.getByText(/confirm application/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /submit application/i }).click();
  await page.waitForURL(/\/student\/opportunities/, { timeout: 15_000 });

  // 8 — DB-verified end state.
  const application = await prisma.application.findFirst({
    where: { studentId: studentForCleanup.id, jobRoleId: { in: (await prisma.jobRole.findMany({ where: { driveId: drive.id }, select: { id: true } })).map((r) => r.id) } },
  });
  expect(application, "no Application row was created").not.toBeNull();
  expect(application?.status).toBe("APPLIED");

  expectNoConsoleErrors(errors, "drive visibility clean chain");

  // Cleanup
  await prisma.application.deleteMany({ where: { driveId: drive.id } });
  await prisma.jobRole.deleteMany({ where: { driveId: drive.id } });
  await prisma.placementDrive.delete({ where: { id: drive.id } });
  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });
});

test("Publishing a drive with zero job roles is blocked, both the menu item and the API", async ({ page }) => {
  const COMPANY = `P2 ZeroRole Co ${RUN}`;
  const DRIVE = `P2 ZeroRole Drive ${RUN}`;
  await prisma.company.deleteMany({ where: { name: COMPANY } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/companies");
  await page.getByRole("button", { name: /add company/i }).click();
  await page.getByLabel(/company name/i).fill(COMPANY);
  await page.getByRole("button", { name: /^create company$/i }).click();
  await page.getByPlaceholder(/search companies/i).fill(COMPANY);
  await expect(page.getByText(COMPANY)).toBeVisible({ timeout: 15_000 });

  await page.goto("/admin/drives");
  await page.getByRole("button", { name: /create drive/i }).click();
  await page.getByRole("combobox").filter({ hasText: /select company/i }).click();
  await page.getByRole("option", { name: COMPANY }).click();
  await page.getByLabel(/drive title/i).fill(DRIVE);
  await fillRequiredDriveDates(page);
  await page.getByRole("dialog").getByRole("button", { name: /^create drive$/i }).click();
  await page.getByPlaceholder(/search drives/i).fill(DRIVE);
  await expect(page.getByText(DRIVE)).toBeVisible({ timeout: 15_000 });

  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE } });

  // The "Change to Published" menu item is disabled — no job roles yet.
  const driveRow = page.locator(".cursor-pointer", { hasText: DRIVE });
  await driveRow.getByRole("button").last().click();
  await expect(page.getByRole("menuitem", { name: /change to published/i })).toBeDisabled();

  // Belt-and-suspenders: the API itself refuses the transition even if
  // called directly, not just a client-side-only guard.
  const res = await page.request.put(`/api/admin/drives/${drive.id}?action=update-status`, {
    data: { status: "PUBLISHED" },
  });
  expect(res.ok()).toBe(false);
  const body = await res.json();
  expect(body.error).toMatch(/job role/i);

  await prisma.placementDrive.delete({ where: { id: drive.id } });
  await prisma.company.deleteMany({ where: { name: COMPANY } });
});

test("A drive scheduled to open in the future does not appear to students until that date", async ({ page }) => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "TP_ADMIN" } });
  const company = await prisma.company.upsert({
    where: { slug: `p2-future-co-${RUN}` },
    update: { isActive: true },
    create: { name: `P2 Future Co ${RUN}`, slug: `p2-future-co-${RUN}`, industry: "TECHNOLOGY", isActive: true },
  });
  const DRIVE = `P2 Future Drive ${RUN}`;
  const drive = await prisma.placementDrive.create({
    data: {
      companyId: company.id, createdById: admin.id, title: DRIVE, academicYear: "2025-2026",
      status: "APPLICATIONS_OPEN",
      applicationOpenAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      applicationCloseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      workMode: "ONSITE",
    },
  });
  await prisma.jobRole.create({ data: { driveId: drive.id, title: "Future Role", isActive: true } });

  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/opportunities");
  await page.getByPlaceholder(/search opportunities/i).fill(DRIVE);
  await expect(page.getByText(DRIVE)).toHaveCount(0);

  await prisma.jobRole.deleteMany({ where: { driveId: drive.id } });
  await prisma.placementDrive.delete({ where: { id: drive.id } });
  await prisma.company.deleteMany({ where: { slug: `p2-future-co-${RUN}` } });
});
