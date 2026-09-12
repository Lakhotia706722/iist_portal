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
import { NotFoundError, BadRequestError, RateLimitedError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";
import { checkRateLimitForKey } from "@/lib/rate-limit";

interface RouteParams {
  params: { type: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("report:read");

    // Phase 16 — P2.2: report generation is real DB + CPU work (query,
    // then CSV/XLSX/PDF serialization) — rate-limit per admin so a
    // scripted loop (or an accidental refresh-mashing) can't turn this
    // into a self-inflicted load problem.
    const limit = await checkRateLimitForKey(user.id as string, { bucket: "report-generate", limit: 10, windowMs: 60_000 });
    if (!limit.allowed) {
      throw new RateLimitedError(
        "Too many report exports in a short time. Please wait a moment and try again.",
        Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))
      );
    }

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
