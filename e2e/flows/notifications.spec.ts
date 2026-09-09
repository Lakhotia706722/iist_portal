import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const SUBJECT_A = `E2E Notification Bell A ${Date.now()}`;
const SUBJECT_B = `E2E Notification Bell B ${Date.now()}`;

/**
 * Phase 10 — P2 flow 4. Seeds two real, unread Notification rows for a
 * real student (the class of row every placement/skillup/etc. action
 * already creates), then drives the actual bell UI: badge count matches
 * the DB, opening the panel renders both, clicking one marks only that
 * one read (DB-verified), "Mark all read" clears the rest (DB-verified),
 * and the badge itself disappears once nothing is unread.
 */
test("Notifications: bell badge count, panel, mark-one-read and mark-all-read all DB-verified", async ({ page }) => {
  test.setTimeout(60_000);

  const studentA = await prisma.student.findUniqueOrThrow({
    where: { enrollmentNumber: ACCOUNTS.studentA.id },
    include: { user: true },
  });

  // Self-cleaning: remove this test's own prior-run notifications, and any
  // other unread notifications on this account so the badge count is
  // exactly the two rows this test seeds (other tests/seeds may have left
  // read notifications behind, which don't affect the unread badge).
  await prisma.notification.deleteMany({ where: { userId: studentA.userId, subject: { contains: "E2E Notification Bell" } } });
  await prisma.notification.updateMany({ where: { userId: studentA.userId, readAt: null }, data: { readAt: new Date() } });

  await prisma.notification.createMany({
    data: [
      { userId: studentA.userId, subject: SUBJECT_A, message: "E2E: first unread notification.", category: "general" },
      { userId: studentA.userId, subject: SUBJECT_B, message: "E2E: second unread notification.", category: "general" },
    ],
  });

  await login(page, ACCOUNTS.studentA.id);

  // 1 — Badge shows exactly 2 unread.
  const bellButton = page.getByRole("button", { name: /notifications \(2 unread\)/i });
  await expect(bellButton).toBeVisible({ timeout: 15_000 });

  // 2 — Open the panel, both notifications render.
  await bellButton.click();
  await expect(page.getByText(SUBJECT_A)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(SUBJECT_B)).toBeVisible();

  // 3 — Click one (no link, so it's a plain mark-read button) — only that
  // one becomes read.
  await page.getByRole("button", { name: SUBJECT_A }).click();
  await expect
    .poll(async () => {
      const n = await prisma.notification.findFirst({ where: { userId: studentA.userId, subject: SUBJECT_A } });
      return n?.readAt !== null;
    }, { timeout: 10_000 })
    .toBe(true);
  const stillUnreadB = await prisma.notification.findFirst({ where: { userId: studentA.userId, subject: SUBJECT_B } });
  expect(stillUnreadB?.readAt).toBeNull();

  // Badge now shows 1.
  await expect(page.getByRole("button", { name: /notifications \(1 unread\)/i })).toBeVisible({ timeout: 10_000 });

  // 4 — "Mark all read" clears the rest. The panel is still open from step
  // 3 (marking a single item read doesn't close it — only clicking a
  // linked item does) — go straight to the button rather than re-clicking
  // the bell, which while the panel's open sits behind its own full-page
  // backdrop (clicking it there just closes the panel, same as the
  // backdrop's own handler — not a bug, just redundant for this test).
  await page.getByRole("button", { name: /mark all read/i }).click();
  await expect(page.getByText(/all notifications marked read/i)).toBeVisible({ timeout: 10_000 });

  const remainingUnread = await prisma.notification.count({ where: { userId: studentA.userId, readAt: null } });
  expect(remainingUnread).toBe(0);

  // Badge disappears entirely once nothing is unread (plain "Notifications", no count).
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible({ timeout: 10_000 });
});
