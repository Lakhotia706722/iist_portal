import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const EVENT_TITLE = `E2E CSE-only Briefing ${Date.now()}`;

/**
 * Phase 10 — P2 flow 6. Real calendar-scoping test between two real
 * students in different batches (studentA/CSE, studentB/AE) — creates a
 * batch-scoped CalendarEvent through the real admin UI (which, until this
 * phase, had no way to set a scope at all despite the field already being
 * wired into the mutation and the API — see the comment on
 * admin-calendar-client.tsx's batchesQuery), then confirms via two real
 * logins that the in-scope student sees it and the out-of-scope student
 * does not.
 */
test("Calendar: admin creates a batch-scoped event", async ({ page }) => {
  test.setTimeout(60_000);

  await prisma.calendarEvent.deleteMany({ where: { title: { contains: "E2E CSE-only Briefing" } } });
  const studentA = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const cseBatchId = studentA.batchId;

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/calendar");
  await page.getByRole("button", { name: /add event/i }).click();
  await page.locator("#ev-title").fill(EVENT_TITLE);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  await page.locator("#ev-start").fill(tomorrow);
  await page.locator("#ev-batch").selectOption(cseBatchId);
  await page.getByRole("dialog").getByRole("button", { name: /^add event$/i }).click();
  await expect(page.getByText(/event created/i)).toBeVisible({ timeout: 15_000 });

  const event = await prisma.calendarEvent.findFirstOrThrow({ where: { title: EVENT_TITLE } });
  expect(event.batchId).toBe(cseBatchId);
});

test("Calendar: the in-scope student (CSE) sees the event", async ({ page }) => {
  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/calendar");
  await page.getByRole("button", { name: "list", exact: true }).click();
  await expect(page.getByText(EVENT_TITLE)).toBeVisible({ timeout: 15_000 });
});

test("Calendar: the out-of-scope student (AE) does not see the event", async ({ page }) => {
  await login(page, ACCOUNTS.studentB.id);
  await page.goto("/student/calendar");
  await page.getByRole("button", { name: "list", exact: true }).click();
  // Give the list a moment to render (something, even if empty) before
  // asserting absence, so this isn't just checking a page that hasn't
  // finished loading yet.
  await expect(page.getByRole("button", { name: "list", exact: true })).toHaveClass(/bg-primary/, { timeout: 10_000 });
  await expect(page.getByText(EVENT_TITLE)).toHaveCount(0);
});
