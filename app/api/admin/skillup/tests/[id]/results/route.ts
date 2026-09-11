/**
 * SkillUp Results - Phase 4
 * GET  - results for a test
 * POST - upload results by enrollment number (manual entry or parsed CSV rows).
 *        Unmatched rows are rejected with row numbers, never silently skipped.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { extractRequestMeta } from "@/server/services/audit.service";
import { listTestResults, uploadResults } from "@/server/services/skillup.service";
import { bulkResultSchema } from "@/lib/validations/skillup";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("skillup:read:all");
    return NextResponse.json({ results: await listTestResults(params.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("skillup:write");
    const data = bulkResultSchema.parse(await request.json());
    const result = await uploadResults(
      params.id,
      data,
      user.id as string,
      extractRequestMeta(request)
    );

    if (result.errors.length > 0) {
      return NextResponse.json(
        {
          error: `${result.errors.length} row(s) could not be matched - no results were saved`,
          errors: result.errors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      message: `${result.inserted} added, ${result.updated} updated`,
      ...result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
