import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 10 — P2 flow 7. Real policy-engine downstream effect: studentB has
 * zero SkillUp results, so with "SkillUp required before applying" off
 * (the default) they're ELIGIBLE. Enabling that policy for their specific
 * batch through the real admin UI must flip their real, server-computed
 * compliance status to CONDITIONAL with the specific reason — not a mock,
 * the actual getComplianceStatus() the rest of the app relies on — then
 * disabling it again must flip it back. Runs as one continuous admin
 * session (no account switch needed).
 */
test("Policy engine: toggling skillup_required for a batch changes a real student's compliance status", async ({ page }) => {
  test.setTimeout(60_000);

  const studentB = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentB.id } });
  // Clean slate: no pre-existing batch override for this key from a prior run.
  await prisma.policyRule.deleteMany({ where: { key: "skillup_required", batchId: studentB.batchId } });

  await login(page, ACCOUNTS.admin.id);

  // 1 — Baseline: no override yet, studentB is ELIGIBLE.
  await page.goto(`/admin/compliance/${studentB.id}`);
  await expect(page.getByText(/^eligible$/i)).toBeVisible({ timeout: 15_000 });

  // 2 — Turn on skillup_required, scoped to studentB's own batch only (not
  // institute-wide, so this can't affect any other concurrently-running
  // flow or student).
  await page.goto("/admin/policy");
  const row = page.locator("div.py-4", { hasText: "SkillUp required before applying" });
  await row.getByRole("button", { name: /^edit$/i }).click();
  await page.locator("#policy-scope").selectOption("batch");
  await page.locator("#policy-batch").selectOption(studentB.batchId);
  // Radix Switch isn't matched by accessible name via its `id` (that's a
  // plain HTML `for`/`id` pairing Radix doesn't wire up) — target it by
  // role alone within the dialog instead.
  const toggle = page.getByRole("dialog").getByRole("switch");
  if ((await toggle.getAttribute("data-state")) !== "checked") {
    await toggle.click();
  }
  await page.getByRole("dialog").getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/policy updated/i)).toBeVisible({ timeout: 15_000 });

  const rule = await prisma.policyRule.findFirstOrThrow({ where: { key: "skillup_required", batchId: studentB.batchId } });
  expect(rule.value).toBe("true");

  // 3 — Real downstream effect: studentB's compliance status actually
  // changes, computed server-side, not toggled client-side.
  await page.goto(`/admin/compliance/${studentB.id}`);
  await expect(page.getByText(/^conditional$/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/no skillup results on record yet/i)).toBeVisible();

  // 4 — Revert: disabling it again flips the status back.
  await page.goto("/admin/policy");
  await row.getByRole("button", { name: /^edit$/i }).click();
  await page.locator("#policy-scope").selectOption("batch");
  await page.locator("#policy-batch").selectOption(studentB.batchId);
  const toggle2 = page.getByRole("dialog").getByRole("switch");
  if ((await toggle2.getAttribute("data-state")) === "checked") {
    await toggle2.click();
  }
  await page.getByRole("dialog").getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(/policy updated/i)).toBeVisible({ timeout: 15_000 });

  await page.goto(`/admin/compliance/${studentB.id}`);
  await expect(page.getByText(/^eligible$/i)).toBeVisible({ timeout: 15_000 });
});
