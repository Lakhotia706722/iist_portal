import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const INTERVIEWER = `E2E Interviewer ${Date.now()}`;

/**
 * Phase 10 — P2 flow 3. Admin schedules a real mock interview for a real
 * student through the UI, records a scorecard (per-category scores,
 * feedback, strengths/weaknesses/suggestions), DB-verifies the computed
 * overallScore, then logs in as the student and confirms they see their
 * own scorecard on their own dashboard.
 */
test("Mock interview: admin schedules and records a scorecard", async ({ page }) => {
  test.setTimeout(60_000);

  const studentA = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  await prisma.mockInterview.deleteMany({ where: { interviewerName: { contains: "E2E Interviewer" } } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/mock-interviews");

  // 1 — Schedule through the real form.
  await page.getByRole("button", { name: /schedule interview/i }).click();
  await page.locator("#mi-student").selectOption(studentA.id);
  await page.locator("#mi-interviewer").fill(INTERVIEWER);
  const scheduledAt = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  await page.locator("#mi-when").fill(scheduledAt);
  await page.locator("#mi-role").fill("SDE-1");
  await page.getByRole("dialog").getByRole("button", { name: /^schedule$/i }).click();
  await expect(page.getByText(/interview scheduled/i)).toBeVisible({ timeout: 15_000 });

  // 2 — Record the scorecard through the real form.
  const row = page.locator("tr", { hasText: INTERVIEWER });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: /record feedback/i }).click();
  await expect(page.getByRole("dialog").getByText(/feedback —/i)).toBeVisible({ timeout: 10_000 });
  await page.locator("#score-technicalScore").fill("8");
  await page.locator("#score-communicationScore").fill("7");
  await page.locator("#score-confidenceScore").fill("9");
  await page.locator("#score-problemSolvingScore").fill("6");
  await page.locator("#score-hrScore").fill("8");
  await page.locator("#score-feedback").fill("E2E: strong fundamentals, needs faster problem decomposition.");
  await page.locator("#score-strengths").fill("Clear communication\nSolid data structures");
  await page.locator("#score-weaknesses").fill("Time management under pressure");
  await page.getByRole("button", { name: /save feedback/i }).click();
  await expect(page.getByText(/feedback recorded/i)).toBeVisible({ timeout: 15_000 });

  // DB-verified: overallScore is the average of the 5 category scores
  // (8+7+9+6+8)/5 = 7.6 — confirms the server actually computed it, not
  // just echoed a client-submitted score.
  const interview = await prisma.mockInterview.findFirstOrThrow({
    where: { interviewerName: INTERVIEWER },
    include: { result: true },
  });
  expect(interview.result).not.toBeNull();
  expect(interview.result?.overallScore).toBeCloseTo(7.6, 5);
  expect(interview.result?.strengths).toEqual(["Clear communication", "Solid data structures"]);
});

// Separate test — a fresh browser context, so logging in as the student
// here doesn't collide with the admin session test 1 already holds (an
// authenticated /login visit just redirects to that user's own dashboard
// rather than showing the form, so a same-context second login silently
// hangs instead of switching accounts).
test("Mock interview: student sees the recorded scorecard", async ({ page }) => {
  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/mock-interviews");
  await expect(page.getByText(INTERVIEWER)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/needs faster problem decomposition/i)).toBeVisible();
});
