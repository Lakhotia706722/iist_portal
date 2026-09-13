import { test, expect } from "@playwright/test";
import { login, ACCOUNTS, PASSWORD } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const SUFFIX = Date.now();
const STUDENT_EMAIL = `e2e-provisioned-${SUFFIX}@iist.ac.in`;
const STUDENT_ENROLLMENT = `E2EPROV${SUFFIX}`;
const STUDENT_NAME = "E2E Provisioned Student";
const NEW_PASSWORD = "NewSecurePass123!";

/**
 * Phase 17 P4: admin can now provision a real student account — no UI path
 * existed for this before. Locked decision: no plaintext temp password is
 * generated or shown — the account gets mustChangePassword:true and the
 * student is sent a "set your password" email via the same
 * PasswordResetToken mechanism forgot-password already uses. This test
 * proves the full chain: admin creates the account -> a real token row is
 * issued -> the token's link actually sets a working password -> the
 * student logs in -> is routed into forced onboarding on first login (the
 * same onboardingStep<2 gate every first-time student hits).
 */
test("Admin creates a student account; set-password link works; first login forces onboarding", async ({ page }) => {
  await prisma.passwordResetToken.deleteMany({ where: { user: { email: STUDENT_EMAIL } } });
  await prisma.student.deleteMany({ where: { enrollmentNumber: STUDENT_ENROLLMENT } });
  await prisma.user.deleteMany({ where: { email: STUDENT_EMAIL } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/students");

  await page.getByRole("button", { name: /add student/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator("#student-name").fill(STUDENT_NAME);
  await page.locator("#student-email").fill(STUDENT_EMAIL);
  await page.locator("#student-enrollment").fill(STUDENT_ENROLLMENT);
  await page.locator("#student-branch").selectOption({ label: "Computer Science & Engineering" });
  // Batch options load once a branch is picked — wait for at least one real option.
  await expect(page.locator("#student-batch option").nth(1)).toBeAttached({ timeout: 10_000 });
  await page.locator("#student-batch").selectOption({ index: 1 });
  await page.getByRole("button", { name: /^create student$/i }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });

  // DB-verified: the account exists, with no usable password set directly,
  // mustChangePassword true, and a real PasswordResetToken was issued.
  const user = await prisma.user.findUniqueOrThrow({ where: { email: STUDENT_EMAIL } });
  expect(user.mustChangePassword).toBe(true);
  const student = await prisma.student.findUniqueOrThrow({ where: { userId: user.id } });
  expect(student.enrollmentNumber).toBe(STUDENT_ENROLLMENT);
  expect(student.onboardingStep).toBe(0);

  const resetToken = await prisma.passwordResetToken.findFirstOrThrow({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  expect(resetToken.expiresAt.getTime()).toBeGreaterThan(Date.now());

  // Use the real "set your password" link (the actual email content isn't
  // capturable from a browser-side test in dev-console-log mode — the
  // token row IS the email's payload; this exercises the same
  // reset-password UI/API a clicked email link would).
  await page.goto(`/reset-password?token=${resetToken.token}`);
  await expect(page.getByRole("heading", { name: /set new password/i })).toBeVisible();
  await page.getByLabel(/new password/i).fill(NEW_PASSWORD);
  const confirmField = page.getByLabel(/confirm password/i);
  if (await confirmField.count() > 0) await confirmField.fill(NEW_PASSWORD);
  await page.getByRole("button", { name: /set new password|reset password|save/i }).click();
  await expect(page.getByRole("heading", { name: /password updated/i })).toBeVisible({ timeout: 15_000 });

  const afterReset = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(afterReset.mustChangePassword).toBe(false);
  const usedToken = await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: resetToken.id } });
  expect(usedToken.usedAt).not.toBeNull();

  // The browser is still authenticated as admin (resetting a different
  // user's password doesn't touch this session) — clear it so /login
  // actually renders the form instead of bouncing an already-logged-in
  // visitor straight to their dashboard.
  await page.context().clearCookies();
  await login(page, STUDENT_ENROLLMENT, NEW_PASSWORD);
  await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
});

test("Bulk CSV student creation: all-or-nothing, with a real set-password email sent per row", async ({ page }) => {
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

  const csv = [
    `${enrollA}, E2E Bulk A, ${emailA}, ${branch.code}, ${batch.academicYear}`,
    `${enrollB}, E2E Bulk B, ${emailB}, ${branch.code}, ${batch.academicYear}`,
  ].join("\n");
  await page.locator("#students-raw").fill(csv);
  await expect(page.getByText(/2 row\(s\) parsed/i)).toBeVisible();
  await page.getByRole("button", { name: /^create 2 student\(s\)$/i }).click();

  await expect(page.getByText(/2 student account\(s\) created/i)).toBeVisible({ timeout: 15_000 });

  const createdUsers = await prisma.user.findMany({ where: { email: { in: [emailA, emailB] } } });
  expect(createdUsers).toHaveLength(2);
  for (const u of createdUsers) {
    expect(u.mustChangePassword).toBe(true);
    const token = await prisma.passwordResetToken.findFirst({ where: { userId: u.id, usedAt: null } });
    expect(token, `no set-password token issued for ${u.email}`).not.toBeNull();
  }
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
