import { test, expect } from "@playwright/test";
import { login, ACCOUNTS, PASSWORD } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const SUFFIX = Date.now();
const NEW_PASSWORD = "NewSecurePass123!";

/**
 * Phase 17 P4 built admin student provisioning with exactly one delivery
 * method: an emailed "set your password" link, no plaintext password ever
 * generated or shown. Phase 18 P1 added a second, now-default method: the
 * admin sets or auto-generates a real password directly, revealed once in
 * a modal that can't be dismissed without an explicit acknowledgment — and
 * kept the email-link method available as an opt-in alternative (the
 * Switch defaults off). These tests cover all three real paths: direct
 * with a manual password, direct with an auto-generated one, and the
 * preserved email-link path — plus bulk CSV, which is always direct.
 */
test("Admin creates a student with a manually-entered password; forced password change on first login", async ({ page }) => {
  const email = `e2e-provisioned-manual-${SUFFIX}@iist.ac.in`;
  const enrollment = `E2EPROVM${SUFFIX}`;
  await prisma.student.deleteMany({ where: { enrollmentNumber: enrollment } });
  await prisma.user.deleteMany({ where: { email } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/students");
  await page.getByRole("button", { name: /add student/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator("#student-name").fill("E2E Provisioned Manual");
  await page.locator("#student-email").fill(email);
  await page.locator("#student-enrollment").fill(enrollment);
  await page.locator("#student-branch").selectOption({ label: "Computer Science & Engineering" });
  await expect(page.locator("#student-batch option").nth(1)).toBeAttached({ timeout: 10_000 });
  await page.locator("#student-batch").selectOption({ index: 1 });
  // Delivery method defaults to "direct" — the password field is visible
  // without touching the "Email a set-password link instead" switch.
  await page.locator("#student-password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: /^create student$/i }).click();

  // The one-time credentials-reveal modal — cannot be dismissed without
  // the explicit acknowledgment checkbox.
  await expect(page.getByRole("heading", { name: /account created/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(NEW_PASSWORD)).toBeVisible();
  const doneButton = page.getByRole("button", { name: /^done$/i });
  await expect(doneButton).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(doneButton).toBeEnabled();
  await doneButton.click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });

  // DB-verified: a real, usable password hash — mustChangePassword still
  // true, and (unlike the email-link path) no PasswordResetToken issued.
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(user.mustChangePassword).toBe(true);
  const token = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
  expect(token, "direct-password path must not also issue a reset token").toBeNull();

  // The password actually works, and forces the change screen before
  // anything else is reachable.
  await page.context().clearCookies();
  await login(page, enrollment, NEW_PASSWORD);
  await page.waitForURL(/\/settings\/change-password/, { timeout: 15_000 });

  await page.getByLabel(/current password/i).fill(NEW_PASSWORD);
  await page.getByLabel(/^new password/i).fill("EvenNewerPass456!");
  await page.getByLabel(/confirm new password/i).fill("EvenNewerPass456!");
  await page.getByRole("button", { name: /^change password$/i }).click();
  await expect(page.getByRole("heading", { name: /password changed successfully/i })).toBeVisible({ timeout: 15_000 });

  const afterChange = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(afterChange.mustChangePassword).toBe(false);
});

test("Admin creates a student with an auto-generated password (left blank)", async ({ page }) => {
  const email = `e2e-provisioned-auto-${SUFFIX}@iist.ac.in`;
  const enrollment = `E2EPROVA${SUFFIX}`;
  await prisma.student.deleteMany({ where: { enrollmentNumber: enrollment } });
  await prisma.user.deleteMany({ where: { email } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/students");
  await page.getByRole("button", { name: /add student/i }).click();

  await page.locator("#student-name").fill("E2E Provisioned Auto");
  await page.locator("#student-email").fill(email);
  await page.locator("#student-enrollment").fill(enrollment);
  await page.locator("#student-branch").selectOption({ label: "Computer Science & Engineering" });
  await expect(page.locator("#student-batch option").nth(1)).toBeAttached({ timeout: 10_000 });
  await page.locator("#student-batch").selectOption({ index: 1 });
  // Password field left blank — server generates one.
  await page.getByRole("button", { name: /^create student$/i }).click();

  await expect(page.getByRole("heading", { name: /account created/i })).toBeVisible({ timeout: 15_000 });
  // Capture the generated password from the reveal modal's monospace text
  // before acknowledging and closing — this is the only place it exists.
  const generatedPassword = await page.locator(".font-mono").first().innerText();
  expect(generatedPassword.length).toBeGreaterThanOrEqual(8);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /^done$/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });

  await page.context().clearCookies();
  await login(page, enrollment, generatedPassword);
  await page.waitForURL(/\/settings\/change-password/, { timeout: 15_000 });
});

test("Admin can still email a set-password link instead of setting a password directly", async ({ page }) => {
  const email = `e2e-provisioned-email-${SUFFIX}@iist.ac.in`;
  const enrollment = `E2EPROVE${SUFFIX}`;
  await prisma.passwordResetToken.deleteMany({ where: { user: { email } } });
  await prisma.student.deleteMany({ where: { enrollmentNumber: enrollment } });
  await prisma.user.deleteMany({ where: { email } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/students");
  await page.getByRole("button", { name: /add student/i }).click();

  await page.locator("#student-name").fill("E2E Provisioned Email");
  await page.locator("#student-email").fill(email);
  await page.locator("#student-enrollment").fill(enrollment);
  await page.locator("#student-branch").selectOption({ label: "Computer Science & Engineering" });
  await expect(page.locator("#student-batch option").nth(1)).toBeAttached({ timeout: 10_000 });
  await page.locator("#student-batch").selectOption({ index: 1 });
  // Opt into the original Phase 17 email-link path.
  await page.getByRole("switch", { name: /email a set-password link instead/i }).click();
  await expect(page.getByText(/no password is set here/i)).toBeVisible();
  await page.getByRole("button", { name: /^create student$/i }).click();

  // No reveal modal for this path — the original toast-only confirmation,
  // and the AddStudentDialog itself closes immediately.
  await expect(page.getByRole("heading", { name: /account created/i })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(user.mustChangePassword).toBe(true);
  const resetToken = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id, usedAt: null } });
  expect(resetToken.expiresAt.getTime()).toBeGreaterThan(Date.now());

  await page.goto(`/reset-password?token=${resetToken.token}`);
  await expect(page.getByRole("heading", { name: /set new password/i })).toBeVisible();
  await page.getByLabel(/new password/i).fill(NEW_PASSWORD);
  const confirmField = page.getByLabel(/confirm password/i);
  if (await confirmField.count() > 0) await confirmField.fill(NEW_PASSWORD);
  await page.getByRole("button", { name: /set new password|reset password|save/i }).click();
  await expect(page.getByRole("heading", { name: /password updated/i })).toBeVisible({ timeout: 15_000 });

  await page.context().clearCookies();
  await login(page, enrollment, NEW_PASSWORD);
  await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
});

test("Bulk CSV student creation: all-or-nothing, with real passwords returned for download", async ({ page }) => {
  const enrollA = `E2EBULK${SUFFIX}A`;
  const enrollB = `E2EBULK${SUFFIX}B`;
  const emailA = `e2e-bulk-${SUFFIX}-a@iist.ac.in`;
  const emailB = `e2e-bulk-${SUFFIX}-b@iist.ac.in`;

  await prisma.student.deleteMany({ where: { enrollmentNumber: { in: [enrollA, enrollB] } } });
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });

  const branch = await prisma.branch.findFirstOrThrow({ where: { code: "BTECH-CSE" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { branchId: branch.id } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/students");
  await page.getByRole("button", { name: /add student/i }).click();
  await page.getByRole("tab", { name: /bulk upload/i }).click();

  // One row supplies its own password; the other leaves the optional 6th
  // column blank to be auto-generated.
  const manualPassword = "BulkManualPass789!";
  const csv = [
    `${enrollA}, E2E Bulk A, ${emailA}, ${branch.code}, ${batch.academicYear}, ${manualPassword}`,
    `${enrollB}, E2E Bulk B, ${emailB}, ${branch.code}, ${batch.academicYear}`,
  ].join("\n");
  await page.locator("#students-raw").fill(csv);
  await expect(page.getByText(/2 row\(s\) parsed/i)).toBeVisible();
  await page.getByRole("button", { name: /^create 2 student\(s\)$/i }).click();

  await expect(page.getByRole("heading", { name: /accounts created/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(manualPassword)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download credentials\.csv/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/student-credentials-.*\.csv/);

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /^done$/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });

  const createdUsers = await prisma.user.findMany({ where: { email: { in: [emailA, emailB] } } });
  expect(createdUsers).toHaveLength(2);
  for (const u of createdUsers) {
    expect(u.mustChangePassword).toBe(true);
    const token = await prisma.passwordResetToken.findFirst({ where: { userId: u.id } });
    expect(token, `bulk creation is always direct — no reset token should exist for ${u.email}`).toBeNull();
  }

  // The manually-supplied password actually works.
  await page.context().clearCookies();
  await login(page, enrollA, manualPassword);
  await page.waitForURL(/\/settings\/change-password|\/onboarding/, { timeout: 15_000 });
});

test("Bulk CSV rejects the whole batch when one row is invalid", async ({ page }) => {
  const goodEnroll = `E2EBULKBAD${SUFFIX}`;
  await prisma.student.deleteMany({ where: { enrollmentNumber: goodEnroll } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/students");
  await page.getByRole("button", { name: /add student/i }).click();
  await page.getByRole("tab", { name: /bulk upload/i }).click();

  // Second row references a branch code that doesn't exist.
  const csv = [
    `${goodEnroll}, E2E Bulk Bad, e2e-bulk-bad-${SUFFIX}@iist.ac.in, CSE, 2021-2025`,
    `E2EBULKBAD2${SUFFIX}, E2E Bulk Bad 2, e2e-bulk-bad2-${SUFFIX}@iist.ac.in, NOSUCHBRANCH, 2021-2025`,
  ].join("\n");
  await page.locator("#students-raw").fill(csv);
  await page.getByRole("button", { name: /^create 2 student\(s\)$/i }).click();

  await expect(page.getByText(/row\(s\) failed validation/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/no branch found/i)).toBeVisible();

  // All-or-nothing: even the valid first row must not have been created.
  const stillMissing = await prisma.student.findFirst({ where: { enrollmentNumber: goodEnroll } });
  expect(stillMissing, "a batch with an invalid row must create nothing at all").toBeNull();
});
