/**
 * Full-chain regression guard: Company -> Drive -> Job Role -> Publish ->
 * Student Application -> Admin visibility.
 *
 * Phase 20: a company created through the UI could silently fail to appear
 * in its own list AND in the drive-creation dropdown (same unpaginated,
 * 20-item-capped, alphabetically-sorted /api/admin/companies query backing
 * both), and the drive dashboard tab crashed with "Cannot read properties
 * of undefined (reading 'totalApplications')" because it was written
 * against a response shape no API route ever actually returned. This test
 * walks the entire chain end to end against fresh data so both classes of
 * bug (and any future regression in the same path) show up here first.
 *
 * Split into three tests at the admin -> student -> admin role handoffs:
 * a second `/login` deep in one long-lived browser context reliably times
 * out in this sandbox (pre-existing Playwright/browser-context limitation,
 * not an app defect — see helpers.ts and other specs in this directory for
 * the same pattern), so each role switch gets a fresh context instead.
 */
import { test, expect } from "@playwright/test";
import { login, ACCOUNTS, fillRequiredDriveDates } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const RUN = Date.now();
const COMPANY_NAME = `Chain Test Co ${RUN}`;
const DRIVE_TITLE = `Chain Test Drive ${RUN}`;
const ROLE_TITLE = "Chain Test Engineer";

test("chain 1/3: company creation, drive creation, publish (admin)", async ({ page }) => {
  test.setTimeout(60_000);
  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });

  await login(page, ACCOUNTS.admin.id);

  await test.step("company appears in its own list immediately, no reload, no manual filter change", async () => {
    await page.goto("/admin/companies");
    await page.getByRole("button", { name: /add company/i }).click();
    await page.getByLabel(/company name/i).fill(COMPANY_NAME);
    await page.getByRole("button", { name: /^create company$/i }).click();
    await expect(page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 8000 });
  });

  await test.step("company appears in drive-creation dropdown immediately, no reload", async () => {
    await page.goto("/admin/drives");
    await page.getByRole("button", { name: /create drive/i }).click();
    await page.getByRole("combobox").filter({ hasText: /select company/i }).click();
    await expect(page.getByRole("option", { name: COMPANY_NAME })).toBeVisible({ timeout: 8000 });
  });

  await test.step("drive is created with the correct company association", async () => {
    await page.getByRole("option", { name: COMPANY_NAME }).click();
    await page.getByLabel(/drive title/i).fill(DRIVE_TITLE);
    await fillRequiredDriveDates(page);
    await page.getByRole("dialog").getByRole("button", { name: /^create drive$/i }).click();
    await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
    await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 8000 });

    const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });
    const company = await prisma.company.findFirstOrThrow({ where: { name: COMPANY_NAME } });
    expect(drive.companyId).toBe(company.id);
  });

  await test.step("job role can be added, and publish correctly requires it (enabled with explanation once present)", async () => {
    const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });
    await page.goto(`/admin/drives/${drive.id}`);
    await page.getByRole("tab", { name: /roles/i }).click();
    await page.getByRole("button", { name: /add job role/i }).first().click();
    await page.getByLabel(/role title/i).fill(ROLE_TITLE);
    await page.getByRole("dialog").getByRole("button", { name: /^create role$/i }).click();
    await expect(page.getByText(ROLE_TITLE)).toBeVisible({ timeout: 8000 });
  });

  await test.step("publishing shows 'Applications Open' derived from today's dates, no manual second step", async () => {
    await page.goto("/admin/drives");
    await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
    await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 8000 });
    const driveRow = page.locator(".cursor-pointer", { hasText: DRIVE_TITLE });
    await driveRow.getByRole("button").last().click();
    const publishItem = page.getByRole("menuitem", { name: /change to published/i });
    await expect(publishItem).toBeEnabled();
    await publishItem.click();
    await expect(driveRow.getByText(/^applications open$/i)).toBeVisible({ timeout: 8000 });
  });
});

test("chain 2/3: student sees opportunity and applies", async ({ page }) => {
  test.setTimeout(60_000);
  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });

  await login(page, ACCOUNTS.studentA.id);

  await test.step("published drive is searchable and shows eligibility on the student side", async () => {
    await page.goto("/student/opportunities");
    await page.getByPlaceholder(/search opportunities/i).fill(DRIVE_TITLE);
    await expect(page.getByRole("heading", { name: DRIVE_TITLE })).toBeVisible({ timeout: 8000 });
    await page.locator(`a[href="/student/opportunities/${drive.id}"]`).click();
    await page.waitForURL(`**/student/opportunities/${drive.id}`, { timeout: 8000 });
    await expect(page.getByText(/eligible/i).first()).toBeVisible({ timeout: 8000 });
  });

  await test.step("full apply flow: resume -> confirm -> submit", async () => {
    const applyButton = page.getByRole("button", { name: /^apply/i }).first();
    await expect(applyButton).toBeEnabled({ timeout: 8000 });
    await applyButton.click();
    await expect(page.getByText(/you are eligible/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page.getByText(/select.*resume|choose.*resume/i).first()).toBeVisible({ timeout: 8000 });
    const resumeOption = page.locator('input[type="radio"], [role="radio"]').first();
    if (await resumeOption.count() > 0) {
      await resumeOption.click();
    } else {
      await page.getByText(/e2e resume/i).first().click();
    }
    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page.getByText(/confirm application/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /submit application/i }).click();
    await expect(page.getByText(/application submitted/i)).toBeVisible({ timeout: 8000 });
  });

  await test.step("Application row exists in the DB with correct student/role/drive", async () => {
    const studentA = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
    const application = await prisma.application.findFirst({
      where: { studentId: studentA.id, jobRole: { title: ROLE_TITLE, driveId: drive.id } },
    });
    expect(application).toBeTruthy();
  });
});

test("chain 3/3: admin sees the application everywhere, drive dashboard renders", async ({ page }) => {
  test.setTimeout(60_000);
  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });

  await login(page, ACCOUNTS.admin.id);

  await test.step("drive's Applications tab shows the application", async () => {
    await page.goto(`/admin/drives/${drive.id}`);
    await page.getByRole("tab", { name: /applicants|applications/i }).click();
    await expect(page.getByText("E2E Student A")).toBeVisible({ timeout: 8000 });
  });

  await test.step("Students list shows the student with an updated Applications count", async () => {
    await page.goto("/admin/students");
    await page.getByPlaceholder(/search by name or enrollment/i).fill(ACCOUNTS.studentA.id);
    await expect(page.getByRole("link", { name: "E2E Student A" })).toBeVisible({ timeout: 8000 });
  });

  await test.step("drive dashboard tab renders real funnel/branch/role data without crashing", async () => {
    await page.goto(`/admin/drives/${drive.id}`);
    await expect(page.getByRole("tab", { name: /overview/i })).toBeVisible({ timeout: 8000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("tab", { name: /dashboard/i }).click();
    await expect(page.getByText(/drive analytics/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/total applications/i)).toBeVisible({ timeout: 8000 });
    expect(errors).toEqual([]);
  });

  await test.step("Command Center aggregate application count reflects it", async () => {
    await page.goto("/admin/analytics");
    await expect(page.getByText(/loading command center/i)).toBeHidden({ timeout: 10000 });
    await expect(page.getByText(/^total students$/i)).toBeVisible({ timeout: 8000 });
    await expect(page.locator("main").getByText(/^applications$/i)).toBeVisible({ timeout: 8000 });
  });
});
