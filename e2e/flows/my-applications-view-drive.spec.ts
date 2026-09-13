import { test, expect } from "@playwright/test";
import { login, trackConsoleErrors, expectNoConsoleErrors, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.afterAll(() => prisma.$disconnect());

/**
 * Phase 17 P0 regression test.
 *
 * Root cause: listStudentApplications()'s Prisma `select` omitted `id` on
 * both `jobRole` and `jobRole.drive`, so the "View Drive" link on My
 * Applications / Journey Tracker built its href from `undefined`, sending
 * students to /student/opportunities/undefined -> a 404
 * `undefined?checkEligibility=true` API call -> "Opportunity Not Found" and
 * no visible Apply option. Fixed in application.service.ts by selecting the
 * ids the frontend already expected. This test exercises exactly the path
 * that was broken: clicking "View Drive" from an existing application.
 */
test("My Applications -> View Drive opens the real drive, not /undefined", async ({ page }) => {
  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const application = await prisma.application.findFirst({
    where: { studentId: student.id },
    include: { jobRole: { include: { drive: true } } },
  });
  expect(application, "fixture requires at least one existing application for Student A").not.toBeNull();

  const errors = trackConsoleErrors(page);
  await login(page, ACCOUNTS.studentA.id);

  await page.goto("/student/applications");
  await expect(page.getByText(/applications/i).first()).toBeVisible({ timeout: 15_000 });

  const viewDriveLink = page.getByRole("link", { name: /view drive/i }).first();
  await expect(viewDriveLink).toBeVisible({ timeout: 15_000 });

  const href = await viewDriveLink.getAttribute("href");
  expect(href, "View Drive link must not point at /undefined").not.toContain("undefined");

  await viewDriveLink.click();
  await page.waitForURL(/\/student\/opportunities\/[^/]+$/, { timeout: 15_000 });
  expect(page.url()).not.toContain("undefined");

  // The real detail page renders (not the 404 "Opportunity Not Found" fallback).
  await expect(page.getByText(/opportunity not found/i)).not.toBeVisible();
  await expect(page.getByText(/about this opportunity|timeline.*details/i).first()).toBeVisible({ timeout: 15_000 });

  expectNoConsoleErrors(errors, "My Applications -> View Drive");
});
