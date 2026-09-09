import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const DOC_NAME = `E2E College ID ${Date.now()}`;

// A minimal but real, valid single-page PDF — not just a renamed .txt file —
// so the upload exercises the same mimeType/content path a real marksheet
// scan would.
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF"
);

/**
 * Phase 10 — P2 flow 5. A student uploads a real file through the real
 * file picker; an admin verifies it through the real admin queue with a
 * note; the student then sees the VERIFIED status and note on their own
 * page. Split into two tests (student, then admin, then student again)
 * since switching accounts mid-test hits an already-authenticated /login
 * redirect (see admin-mock-interview.spec.ts).
 */
test("Documents: student uploads a real file", async ({ page }) => {
  test.setTimeout(60_000);

  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  await prisma.document.deleteMany({ where: { studentId: student.id, name: { contains: "E2E College ID" } } });

  const pdfPath = path.join(os.tmpdir(), `e2e-doc-${Date.now()}.pdf`);
  fs.writeFileSync(pdfPath, MINIMAL_PDF);

  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/documents");
  await page.getByRole("button", { name: /upload document/i }).first().click();
  await page.locator("#doc-type").selectOption("COLLEGE_ID");
  await page.locator("#doc-name").fill(DOC_NAME);
  await page.locator('input[type="file"]').setInputFiles(pdfPath);
  await page.getByRole("dialog").getByRole("button", { name: /^upload$/i }).click();
  await expect(page.getByText(DOC_NAME)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("tr", { hasText: DOC_NAME })).toContainText(/pending/i);

  const doc = await prisma.document.findFirstOrThrow({ where: { studentId: student.id, name: DOC_NAME } });
  expect(doc.status).toBe("PENDING");
  expect(doc.sizeBytes).toBe(MINIMAL_PDF.length);
  expect(doc.mimeType).toBe("application/pdf");

  fs.unlinkSync(pdfPath);
});

test("Documents: admin verifies it with a note", async ({ page }) => {
  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/documents");
  await page.getByPlaceholder(/search student or document/i).fill(DOC_NAME);
  const row = page.locator("tr", { hasText: DOC_NAME });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: /^verify$/i }).click();
  await page.locator("#admin-note").fill("E2E: matches student record, approved.");
  await page.getByRole("dialog").getByRole("button", { name: /^verify$/i }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });

  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const doc = await prisma.document.findFirstOrThrow({ where: { studentId: student.id, name: DOC_NAME } });
  expect(doc.status).toBe("VERIFIED");
  expect(doc.adminNote).toBe("E2E: matches student record, approved.");
  expect(doc.verifiedAt).not.toBeNull();
});

test("Documents: student sees the verified status and note", async ({ page }) => {
  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/documents");
  const row = page.locator("tr", { hasText: DOC_NAME });
  await expect(row).toContainText(/verified/i, { timeout: 15_000 });
  await expect(row).toContainText("E2E: matches student record, approved.");
});
