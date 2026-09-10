import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const SKILL_NAME = `E2E Skill ${Date.now()}`;

/**
 * Phase 12 — Admin's "Skills Catalog" page had a full CRUD API since an
 * earlier phase but no UI (nav-config.tsx flagged it comingSoon, and no
 * page.tsx existed). Real create → edit → deactivate through the actual
 * dialog, each step DB-verified.
 */
test("Skills Catalog: create, edit, and deactivate a skill through the real UI", async ({ page }) => {
  test.setTimeout(60_000);

  // Self-cleaning
  await prisma.studentSkill.deleteMany({ where: { skill: { name: { contains: "E2E Skill" } } } });
  await prisma.skill.deleteMany({ where: { name: { contains: "E2E Skill" } } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/skills");

  // 1 — Create
  await page.getByRole("button", { name: /add skill/i }).click();
  await page.locator("#sk-name").fill(SKILL_NAME);
  await page.locator("#sk-category").selectOption("PROGRAMMING");
  await page.getByRole("dialog").getByRole("button", { name: /^create$/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(SKILL_NAME)).toBeVisible({ timeout: 15_000 });

  const created = await prisma.skill.findFirst({ where: { name: SKILL_NAME } });
  expect(created, "skill was not persisted").not.toBeNull();
  expect(created?.category).toBe("PROGRAMMING");
  expect(created?.isActive).toBe(true);

  // 2 — Edit (change category)
  const row = page.locator("tr", { hasText: SKILL_NAME });
  await row.getByRole("button").first().click(); // edit (pencil) icon
  await expect(page.getByRole("dialog").getByText("Edit Skill")).toBeVisible();
  await page.locator("#sk-category").selectOption("TOOLS");
  await page.getByRole("dialog").getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const edited = await prisma.skill.findUniqueOrThrow({ where: { id: created!.id } });
  expect(edited.category).toBe("TOOLS");

  // 3 — Deactivate
  await row.getByRole("button").nth(1).click(); // delete (trash) icon
  await expect(page.getByRole("dialog").getByText(/deactivate skill/i)).toBeVisible();
  await page.getByRole("button", { name: /^deactivate$/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(async () => {
    const deactivated = await prisma.skill.findUniqueOrThrow({ where: { id: created!.id } });
    expect(deactivated.isActive).toBe(false);
  }).toPass({ timeout: 10_000 });

  // Soft-delete, not a hard delete — the row still exists.
  const stillExists = await prisma.skill.findUnique({ where: { id: created!.id } });
  expect(stillExists, "deactivate must be a soft-delete (isActive:false), not a hard delete").not.toBeNull();
});
