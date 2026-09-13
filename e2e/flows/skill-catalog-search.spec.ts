import { test, expect } from "@playwright/test";
import { login, trackConsoleErrors, expectNoConsoleErrors, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.afterAll(() => prisma.$disconnect());

/**
 * Phase 17 P2 regression test.
 *
 * Root cause: the "Select Skill" dropdown wasn't broken code — the Skill
 * catalog table was simply unseeded in this environment (only 3 leftover
 * test-fixture rows existed, no "Python"). Fixed by expanding and running
 * prisma/seed-reference-data.ts. This test proves the real student-facing
 * search -> select -> add -> profile flow works against the real catalog,
 * DB-verified end to end.
 */
test("Add Skill from Catalog: search 'python', select, add, and see it on the profile", async ({ page }) => {
  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentB.id } });

  // Self-cleaning: remove any prior Python StudentSkill for this student.
  const pythonSkill = await prisma.skill.findFirst({ where: { name: "Python" } });
  expect(pythonSkill, "Skill catalog must contain 'Python' for this test to be meaningful").not.toBeNull();
  await prisma.studentSkill.deleteMany({ where: { studentId: student.id, skillId: pythonSkill!.id } });

  const errors = trackConsoleErrors(page);
  await login(page, ACCOUNTS.studentB.id);
  await page.goto("/student/profile/skills");

  await page.getByRole("button", { name: /add from catalog/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator("#skill-search").fill("python");
  const skillSelect = page.locator("#skill-id");
  await expect(async () => {
    const optionCount = await skillSelect.locator("option", { hasText: /python/i }).count();
    expect(optionCount, "'Python' did not appear in the catalog dropdown after searching").toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });

  await skillSelect.selectOption({ label: "Python (Programming)" });
  await page.locator("#skill-level").selectOption("INTERMEDIATE");
  await page.getByRole("dialog").getByRole("button", { name: /^add skill$/i }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Python").first()).toBeVisible({ timeout: 15_000 });

  // DB-verified: a real StudentSkill row now links this student to Python.
  const created = await prisma.studentSkill.findFirst({
    where: { studentId: student.id, skillId: pythonSkill!.id },
  });
  expect(created, "no StudentSkill row was created").not.toBeNull();
  expect(created?.level).toBe("INTERMEDIATE");

  expectNoConsoleErrors(errors, "skill catalog search/add");
});
