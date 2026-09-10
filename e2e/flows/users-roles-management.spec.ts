import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const timestamp = Date.now();
const NAME = `E2E Faculty User ${timestamp}`;
const EMAIL = `e2e-new-faculty-${timestamp}@iist.ac.in`;

/**
 * Phase 12 — Admin's "Users & Roles" page had zero backend
 * (app/api/admin/users was an empty directory) and no UI. Real create of a
 * staff account through the dialog, DB-verified (User row + role-specific
 * profile row + mustChangePassword forced true), then deactivate through
 * the same UI.
 */
test("Users & Roles: create a Faculty account, then deactivate it", async ({ page }) => {
  test.setTimeout(60_000);

  // Self-cleaning
  const priorUser = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (priorUser) {
    await prisma.facultyProfile.deleteMany({ where: { userId: priorUser.id } });
    await prisma.user.delete({ where: { id: priorUser.id } });
  }

  const department = await prisma.department.findFirstOrThrow({ where: { isActive: true } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/users-roles");

  // 1 — Create
  await page.getByRole("button", { name: /add user/i }).click();
  await page.locator("#u-name").fill(NAME);
  await page.locator("#u-email").fill(EMAIL);
  await page.locator("#u-role").selectOption("FACULTY");
  await page.locator("#u-empid").fill(`E2EEMP${timestamp}`);
  await page.locator("#u-dept").selectOption(department.id);
  await page.locator("#u-desig").fill("Assistant Professor");
  await page.getByRole("dialog").getByRole("button", { name: /^create$/i }).click();

  // A one-time temp-password dialog replaces the create dialog on success.
  const credDialog = page.getByRole("dialog");
  await expect(credDialog.getByText("Account Created")).toBeVisible({ timeout: 15_000 });
  await expect(credDialog.getByText(EMAIL)).toBeVisible();
  await credDialog.getByRole("button", { name: /^done$/i }).click();

  await expect(page.getByText(NAME)).toBeVisible({ timeout: 10_000 });

  const created = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { facultyProfile: true },
  });
  expect(created, "user was not persisted").not.toBeNull();
  expect(created?.role).toBe("FACULTY");
  expect(created?.isActive).toBe(true);
  expect(created?.mustChangePassword, "a new staff account must be forced to set its own password").toBe(true);
  expect(created?.facultyProfile, "FacultyProfile row was not created alongside the User").not.toBeNull();
  expect(created?.facultyProfile?.departmentId).toBe(department.id);

  // 2 — Deactivate through the same UI
  const row = page.locator("tr", { hasText: EMAIL });
  await row.getByRole("button", { name: /deactivate/i }).click();
  const confirmDialog = page.getByRole("dialog");
  await expect(confirmDialog.getByText(/deactivate user/i)).toBeVisible();
  await confirmDialog.getByRole("button", { name: /^deactivate$/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(async () => {
    const deactivated = await prisma.user.findUniqueOrThrow({ where: { id: created!.id } });
    expect(deactivated.isActive).toBe(false);
  }).toPass({ timeout: 10_000 });
});

/**
 * The last-active-admin guard (server-side, user.service.ts's
 * setUserActive) — can't be exercised through the real UI without actually
 * locking the test run out of the admin portal, so this hits the API
 * directly with the logged-in admin's own session, same as the app does.
 */
test("Users & Roles: cannot deactivate the last active T&P Admin", async ({ page }) => {
  const activeAdmins = await prisma.user.count({ where: { role: "TP_ADMIN", isActive: true } });
  test.skip(activeAdmins > 1, "more than one active admin exists in this environment — guard isn't exercised");

  await login(page, ACCOUNTS.admin.id);
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS.admin.email } });

  const response = await page.request.patch(`/api/admin/users/${admin.id}`, {
    data: { isActive: false },
  });
  expect(response.status(), "deactivating the last active admin must be rejected").toBeGreaterThanOrEqual(400);

  const stillActive = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
  expect(stillActive.isActive).toBe(true);
});
