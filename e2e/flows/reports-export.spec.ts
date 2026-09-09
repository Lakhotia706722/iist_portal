import * as fs from "fs";
import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 10 — P2 flow 9. Real file downloads through the real UI links (not
 * a direct fetch of the API route) for all three export formats of the
 * same report, verifying each is a real, non-trivial, correctly-typed
 * file — CSV content is checked for an actual student's enrollment
 * number, XLSX/PDF are checked for their real magic-byte file signatures
 * (a genuine .zip-based OOXML file, a genuine %PDF file), not just a
 * non-empty response.
 */
test("Reports: CSV, XLSX and PDF exports are real, correctly-formatted files", async ({ page }) => {
  test.setTimeout(60_000);

  const studentA = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/reports");
  const card = page.locator(".rounded-xl.border", { hasText: "Student Database" });
  await expect(card).toBeVisible({ timeout: 15_000 });

  // CSV
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    card.getByRole("link", { name: /^csv$/i }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(/^students-\d{4}-\d{2}-\d{2}\.csv$/);
  const csvPath = await csvDownload.path();
  const csvText = fs.readFileSync(csvPath!, "utf-8");
  expect(csvText).toContain(studentA.enrollmentNumber);
  expect(csvText.split("\n").length).toBeGreaterThan(1); // header + at least one data row

  // XLSX — real OOXML files are zip archives, always starting with "PK".
  const [xlsxDownload] = await Promise.all([
    page.waitForEvent("download"),
    card.getByRole("link", { name: /^excel$/i }).click(),
  ]);
  expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/);
  const xlsxPath = await xlsxDownload.path();
  const xlsxHeader = fs.readFileSync(xlsxPath!).subarray(0, 2).toString("ascii");
  expect(xlsxHeader).toBe("PK");

  // PDF — real PDFs always start with the "%PDF-" magic bytes.
  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    card.getByRole("link", { name: /^pdf$/i }).click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = await pdfDownload.path();
  const pdfHeader = fs.readFileSync(pdfPath!).subarray(0, 5).toString("ascii");
  expect(pdfHeader).toBe("%PDF-");

  // Every export writes an audit log row (see the route's writeAuditLog call).
  const exportLogs = await prisma.auditLog.count({
    where: { action: "EXPORT", entity: "Report", entityId: "students" },
  });
  expect(exportLogs).toBeGreaterThanOrEqual(3);
});
