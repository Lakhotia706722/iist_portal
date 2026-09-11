import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const TEST_TITLE = `E2E SkillUp Test ${Date.now()}`;

/**
 * Phase 10 — P2 flow 2. Create a real SkillUp test through the UI, then
 * upload a real CSV file with one valid row and one malformed row (an
 * enrollment number that doesn't match any eligible student) through the
 * real file picker. The results API is documented as all-or-nothing
 * ("Nothing was saved") when any row fails to match — this verifies that
 * atomicity for real: the bad upload must leave zero TestResult rows, the
 * UI must surface the specific bad row, and a corrected upload with only
 * the valid row must then actually persist.
 */
test("SkillUp: create test, CSV upload with a malformed row is rejected atomically, then a clean upload saves", async ({ page }) => {
  test.setTimeout(60_000);

  // Self-cleaning
  const prior = await prisma.test.findMany({ where: { title: { contains: "E2E SkillUp Test" } }, select: { id: true } });
  for (const t of prior) {
    await prisma.testResult.deleteMany({ where: { testId: t.id } });
    await prisma.testParticipant.deleteMany({ where: { testId: t.id } });
    await prisma.test.delete({ where: { id: t.id } });
  }

  const studentA = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  // CSE and AE batches share the same name/academicYear ("2021-2025"), so
  // the "Batch scope" <select>'s option *text* is ambiguous between them —
  // select by the CSE batch's real id instead of trusting a label match.
  const cseBatchId = studentA.batchId;

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/skillup");

  // 1 — Create a test through the real form, scoped to CSE (studentA's batch).
  await page.getByRole("button", { name: /create test/i }).click();
  await page.locator("#test-title").fill(TEST_TITLE);
  const scheduledAt = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  await page.locator("#test-when").fill(scheduledAt);
  await page.locator("#test-max").fill("100");
  await page.locator("#test-pass").fill("40");
  await page.locator("#test-batch").selectOption(cseBatchId);
  await page.getByRole("dialog").getByRole("button", { name: /^create test$/i }).click();
  await expect(page.getByText(TEST_TITLE)).toBeVisible({ timeout: 15_000 });

  // 2 — Open Results, upload a CSV with one valid row + one row whose
  // enrollment number doesn't exist.
  const row = page.locator("tr", { hasText: TEST_TITLE });
  await row.getByRole("button", { name: /results/i }).click();
  await expect(page.getByRole("dialog").getByText(`Results — ${TEST_TITLE}`)).toBeVisible({ timeout: 15_000 });

  const badCsvPath = path.join(os.tmpdir(), `e2e-skillup-bad-${Date.now()}.csv`);
  fs.writeFileSync(badCsvPath, [`${ACCOUNTS.studentA.id},78,solid performance`, `IIST9999ZZ99,60,no such student`].join("\n"));
  await page.locator('input[type="file"]').setInputFiles(badCsvPath);
  await expect(page.getByText(/2 row\(s\) parsed/i)).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /^publish 2 result/i }).click();

  // The malformed row must block the WHOLE batch — surfaced in the UI...
  await expect(page.getByRole("alert").getByText(/nothing was saved/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("alert").getByText(/IIST9999ZZ99/)).toBeVisible();
  // ...and DB-verified: zero results for either row, not just the bad one.
  const afterBadUpload = await prisma.testResult.findMany({ where: { test: { title: TEST_TITLE } } });
  expect(afterBadUpload, "a malformed row let the whole batch through instead of blocking it").toHaveLength(0);

  // 3 — Corrected upload: only the valid row.
  const goodCsvPath = path.join(os.tmpdir(), `e2e-skillup-good-${Date.now()}.csv`);
  fs.writeFileSync(goodCsvPath, `${ACCOUNTS.studentA.id},78,solid performance`);
  await page.locator('input[type="file"]').setInputFiles(goodCsvPath);
  await expect(page.getByText(/1 row\(s\) parsed/i)).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /^publish 1 result/i }).click();
  await expect(page.getByText(/results published/i)).toBeVisible({ timeout: 15_000 });

  // DB-verified end state.
  const result = await prisma.testResult.findFirst({ where: { test: { title: TEST_TITLE }, studentId: studentA.id } });
  expect(result, "the corrected upload did not persist a TestResult row").not.toBeNull();
  expect(result?.marksObtained).toBe(78);
  expect(result?.isPassed).toBe(true);

  fs.unlinkSync(badCsvPath);
  fs.unlinkSync(goodCsvPath);
});
