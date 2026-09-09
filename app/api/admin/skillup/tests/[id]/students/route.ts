import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getEligibleStudents } from "@/server/services/skillup.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("skillup:read:all");
    return NextResponse.json({ students: await getEligibleStudents(params.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
