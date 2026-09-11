/**
 * Global search - Phase 5
 * Department-sensitive results are scoped server-side for FACULTY/HOD.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { resolveSearchScope, globalSearch } from "@/server/services/search.service";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("search:read");
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const scope = await resolveSearchScope(user.id as string, user.role as string);
    const results = await globalSearch(q, scope);
    return NextResponse.json({ results, scoped: !!scope.departmentId });
  } catch (error) {
    return handleApiError(error);
  }
}
