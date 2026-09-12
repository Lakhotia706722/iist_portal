/**
 * AI usage visibility — Phase 16, P6.3.
 * GET /api/admin/ai-usage?days=30 -> per-day call count, token totals, and
 * a rough cost estimate (see lib/ai/usage.ts for the pricing assumption).
 * Exists so AI spend is checkable at any time, not discovered at the end
 * of a billing cycle.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getAiUsageSummary } from "@/lib/ai/usage";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("report:read");
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30", 10) || 30));
    const summary = await getAiUsageSummary(days);
    const totals = summary.reduce(
      (acc, day) => ({
        calls: acc.calls + day.calls,
        inputTokens: acc.inputTokens + day.inputTokens,
        outputTokens: acc.outputTokens + day.outputTokens,
        estimatedCostUsd: acc.estimatedCostUsd + day.estimatedCostUsd,
      }),
      { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
    );
    return NextResponse.json({ days: summary, totals });
  } catch (error) {
    return handleApiError(error);
  }
}
