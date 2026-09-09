/**
 * Report export — Phase 5
 * GET /api/admin/reports/[type]?format=csv|xlsx|pdf&...filters
 *
 * Every export is generated server-side from the same registry entry
 * (see lib/reports/registry.ts) regardless of format, so CSV/XLSX/PDF for a
 * given report always contain the same rows.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { writeAuditLog, extractRequestMeta } from "@/server/services/audit.service";
import { REPORTS } from "@/lib/reports/registry";
import { toCSV, toXLSX, toPDF, contentTypeFor, extensionFor } from "@/lib/reports/serialize";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { type: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("report:read");

    const report = REPORTS[params.type];
    if (!report) throw new NotFoundError(`Unknown report: ${params.type}`);

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") ?? "csv").toLowerCase();
    if (!["csv", "xlsx", "pdf"].includes(format)) {
      throw new BadRequestError("format must be csv, xlsx, or pdf");
    }

    const rows = await report.fetch(searchParams);

    let body: string | Buffer;
    if (format === "xlsx") {
      body = await toXLSX(report.label, report.columns, rows);
    } else if (format === "pdf") {
      body = await toPDF(report.label, report.columns, rows);
    } else {
      body = toCSV(report.columns, rows);
    }

    await writeAuditLog({
      userId: user.id as string,
      action: "EXPORT",
      entity: "Report",
      entityId: report.key,
      metadata: { format, rowCount: rows.length, filters: Object.fromEntries(searchParams.entries()) },
      ...extractRequestMeta(request),
    });

    const filename = `${report.key}-${new Date().toISOString().slice(0, 10)}.${extensionFor(format)}`;

    return new NextResponse(body as any, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(format),
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
