/**
 * Pre-placement talk, student view - Phase 4
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { getPrePlacementTalk } from "@/server/services/calendar.service";
import { handleApiError } from "@/lib/api-utils";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("drive:read");
    return NextResponse.json({ talk: await getPrePlacementTalk(params.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
