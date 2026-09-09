/**
 * Report serializers — Phase 5
 *
 * Shared by every report type, so CSV/XLSX/PDF export is one implementation
 * each, driven by a report's columns + rows (see lib/reports/registry.ts).
 * The CSV quoting logic matches the pattern already used client-side in the
 * Phase 4 applicant/attendance CSV exports.
 */

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { ReportColumn } from "./registry";

export function toCSV(columns: ReportColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => r[c.key] ?? ""));
  return [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

export async function toXLSX(
  reportLabel: string,
  columns: ReportColumn[],
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IIST Placement Portal";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(reportLabel.slice(0, 31) || "Report");
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(c.label.length + 4, 14) }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRows(rows);

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function toPDF(
  reportLabel: string,
  columns: ReportColumn[],
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(reportLabel, { align: "left" });
    doc.fontSize(9).fillColor("#666").text(`Generated ${new Date().toLocaleString()} — ${rows.length} row(s)`);
    doc.moveDown(0.5);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;
    const rowHeight = 18;

    function drawHeader() {
      const y = doc.y;
      doc.fontSize(8).fillColor("#000").font("Helvetica-Bold");
      columns.forEach((c, i) => {
        doc.text(c.label, doc.page.margins.left + i * colWidth, y, { width: colWidth - 4, ellipsis: true });
      });
      doc.font("Helvetica");
      doc.moveDown();
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ccc").stroke();
      doc.moveDown(0.2);
    }

    drawHeader();

    doc.fontSize(8).fillColor("#000");
    for (const row of rows) {
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ margin: 30, size: "A4", layout: "landscape" });
        drawHeader();
      }
      const y = doc.y;
      columns.forEach((c, i) => {
        const val = row[c.key];
        doc.text(val == null ? "" : String(val), doc.page.margins.left + i * colWidth, y, {
          width: colWidth - 4,
          ellipsis: true,
        });
      });
      doc.moveDown(0.9);
    }

    doc.end();
  });
}

export function contentTypeFor(format: string): string {
  switch (format) {
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pdf":
      return "application/pdf";
    default:
      return "text/csv";
  }
}

export function extensionFor(format: string): string {
  return format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv";
}
