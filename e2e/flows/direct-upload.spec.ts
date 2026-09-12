import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 16 — P5. Confirms the resume-upload path actually migrated to the
 * presigned-URL flow (hooks/use-direct-upload.ts) through the real UI, not
 * just via a direct API call — the file never touches
 * /api/student/resumes/:id/versions; only the resulting key does.
 */
test("Resume PDF upload goes through the direct-to-storage flow end to end", async ({ page }) => {
  test.setTimeout(60_000);

  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const resumeName = `E2E Direct Upload Resume ${Date.now()}`;
  const resume = await prisma.resume.create({ data: { studentId: student.id, name: resumeName, isDefault: false } });

  // Watch the network: the confirm POST must carry a `key`, never a
  // multipart body with actual file bytes.
  let confirmRequestBody: string | null = null;
  page.on("request", (req) => {
    if (req.url().includes(`/api/student/resumes/${resume.id}/versions`) && req.method() === "POST") {
      confirmRequestBody = req.postData();
    }
  });

  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/resume");
  await expect(page.getByText(resumeName)).toBeVisible({ timeout: 15_000 });

  // Scope to this specific resume's Card — studentA may already have
  // other resumes from earlier tests/manual exploration, each with their
  // own "Add Version" button.
  const resumeCard = page.locator(".rounded-xl", { hasText: resumeName });
  await resumeCard.getByRole("button", { name: /add version/i }).click();

  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/version notes/i).fill("E2E direct-upload test version");

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "e2e-direct-upload-test.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fake resume for the direct-upload e2e test"),
  });

  await page.getByRole("button", { name: /^upload pdf version$/i }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });

  // The confirm request must be JSON carrying a storage key, not the PDF bytes.
  expect(confirmRequestBody).not.toBeNull();
  const parsed = JSON.parse(confirmRequestBody!);
  expect(parsed.key).toMatch(/^resumes\//);
  expect(parsed).not.toHaveProperty("file");

  // DB-verified end state: the version really was recorded, pointing at
  // the object the browser PUT directly to storage.
  const version = await prisma.resumeVersion.findFirstOrThrow({
    where: { resumeId: resume.id },
    orderBy: { createdAt: "desc" },
  });
  expect(version.fileKey).toBe(parsed.key);
  expect(version.isGenerated).toBe(false);

  await prisma.resumeVersion.deleteMany({ where: { resumeId: resume.id } });
  await prisma.resume.delete({ where: { id: resume.id } });
});
